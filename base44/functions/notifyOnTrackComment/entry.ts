import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendPushToUser } from '../../shared/webPush.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    if (event?.type !== 'create' || !data?.id) return Response.json({ success: true });

    const entities = base44.asServiceRole.entities;
    const comment = await entities.TrackComment.get(data.id);
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

    try {
      await entities.Notification.create(notification);
      await sendPushToUser(entities, notification.recipient_id, {
        title: notification.actor_name,
        body: notification.message,
        url: notification.link,
      });
      return Response.json({ success: true, count: 1 });
    } catch {
      return Response.json({ success: true, count: 0, duplicate: true });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
