import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Handles entity-create events for targeted notifications.
// IMPORTANT: Never broadcast notifications to all users — only notify
// the specific person who needs to know (e.g., the track creator on a
// new comment).  Mass broadcasts caused severe database bloat.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data } = body;

    const entityName = event?.entity_name;
    const eventType = event?.type;

    if (eventType !== 'create' || !data) {
      return Response.json({ ok: true });
    }

    // TrackComment — notify the track's creator (targeted, not broadcast)
    if (entityName === 'TrackComment') {
      const authorId = data.author_id;
      const authorName = data.author_name || 'Someone';
      const commentText = data.text || 'a comment';
      const trackId = data.track_id;

      // Find the ArtPost to get its creator
      const posts = await base44.asServiceRole.entities.ArtPost.filter({ id: trackId });
      const post = posts[0];
      if (post && post.creator_id && post.creator_id !== authorId) {
        await base44.asServiceRole.entities.Notification.create({
          recipient_id: post.creator_id,
          type: 'comment',
          actor_id: authorId,
          actor_name: authorName,
          actor_avatar: data.author_avatar || null,
          message: `commented on your track "${post.title}": "${commentText.slice(0, 60)}${commentText.length > 60 ? '…' : ''}"`,
          link: '/explore',
          read: false,
        });
        console.log(`Notified ${post.creator_id} about comment on track: ${post.title}`);
      }
    }

    // ArtPost, SharedFile, and Message notifications are handled by their
    // dedicated functions (notifyOnFileUpload, notifyOnMessage, etc.) —
    // do NOT duplicate them here, and do NOT broadcast to all users.

    return Response.json({ ok: true });
  } catch (error) {
    console.error('onNewContent error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});