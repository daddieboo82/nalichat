import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendPushToUser } from '../../shared/webPush.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type !== 'create') return Response.json({ success: true });
    if (!data.track_id) return Response.json({ success: true });

    // track_id references the ArtPost being commented on
    let track;
    try {
      track = await base44.asServiceRole.entities.ArtPost.get(data.track_id);
    } catch {
      return Response.json({ success: true }); // track no longer exists
    }
    if (!track) return Response.json({ success: true });

    // Notify the track creator, excluding the commenter
    if (!track.creator_id || track.creator_id === data.author_id) {
      return Response.json({ success: true, count: 0 });
    }

    const commentPreview = data.text
      ? `: "${data.text.slice(0, 60)}${data.text.length > 60 ? '…' : ''}"`
      : '';

    const notification = {
      recipient_id: track.creator_id,
      type: 'comment',
      actor_id: data.author_id,
      actor_name: data.author_name || 'Someone',
      actor_avatar: data.author_avatar,
      message: `commented on your track "${track.title}"${commentPreview}`,
      link: '/explore',
    };

    await base44.asServiceRole.entities.Notification.create(notification);
    await sendPushToUser(base44.asServiceRole.entities, notification.recipient_id, {
      title: notification.actor_name,
      body: notification.message,
      url: notification.link,
    });

    return Response.json({ success: true, count: 1 });
  } catch (error) {
    console.error('notifyOnTrackComment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});