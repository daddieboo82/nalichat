import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { sendPushToUser } from '../../shared/webPush.ts';
import { workflowEntityRecordId, workflowRecordIsFresh } from '../../shared/workflowEvents.ts';
import { createNotificationIdempotently } from '../../shared/workflowNotifications.ts';
import { claimFixedWindow } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    const { event, data } = await readJsonBodyLimited(req, 64 * 1024);
    const record = workflowEntityRecordId({ event, data });
    if (record.invalid) return Response.json({ error: 'Invalid entity id' }, { status: 400 });
    if (record.conflict) return Response.json({ error: 'Conflicting entity ids' }, { status: 400 });
    if (event?.type !== 'create' || !record.id) return Response.json({ success: true });

    const entities = base44.asServiceRole.entities;
    const comment = await entities.TrackComment.get(record.id);
    if (!comment || !workflowRecordIsFresh(comment, 'create')) {
      return Response.json({ success: true, count: 0, skipped: 'stale_workflow_record' });
    }
    const eventClaim = await claimFixedWindow(
      entities,
      `workflow-track-comment:${comment.id}`,
      10,
    );
    if (!eventClaim.allowed) {
      return Response.json({ success: true, count: 0, skipped: 'already_processed' });
    }
    if (!comment?.track_id || (comment.parent_type && comment.parent_type !== 'art_post')) {
      return Response.json({ success: true });
    }

    const post = await entities.ArtPost.get(comment.track_id);
    if (!post?.creator_id || post.creator_id === comment.author_id) {
      return Response.json({ success: true, count: 0 });
    }

    const preview = comment.text
      ? `: "${comment.text.slice(0, 60)}${comment.text.length > 60 ? '…' : ''}"`
      : '';
    const notification = {
      id: `notification_comment_${comment.id}_${post.creator_id}`,
      recipient_id: post.creator_id,
      type: 'comment',
      actor_id: comment.author_id,
      actor_name: comment.author_name || 'Someone',
      actor_avatar: comment.author_avatar,
      message: `commented on your track "${post.title}"${preview}`,
      link: '/explore',
    };

    const result = await createNotificationIdempotently(entities.Notification, notification);
    if (!result.created) {
      return Response.json({ success: true, count: 0, duplicate: true });
    }
    try {
      await sendPushToUser(entities, notification.recipient_id, {
        title: notification.actor_name,
        body: notification.message,
        url: notification.link,
      });
    } catch (pushError) {
      console.error('Comment push delivery failed:', pushError);
    }
    return Response.json({ success: true, count: 1 });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('notifyOnTrackComment error:', error);
    return Response.json({ error: 'Workflow processing failed' }, { status: 500 });
  }
});
