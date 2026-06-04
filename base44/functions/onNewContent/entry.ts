import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    // Get all users to notify (excluding the creator)
    const allUsers = await base44.asServiceRole.entities.User.list();

    if (entityName === 'ArtPost') {
      const creatorId = data.creator_id;
      const title = data.title || 'a new track';
      const creatorName = data.creator_name || 'Someone';

      const recipients = allUsers.filter(u => u.id !== creatorId);
      await Promise.all(
        recipients.map(u =>
          base44.asServiceRole.entities.Notification.create({
            recipient_id: u.id,
            type: 'file',
            actor_id: creatorId,
            actor_name: creatorName,
            actor_avatar: data.creator_avatar || null,
            message: `shared a new track: "${title}"`,
            link: '/explore',
            read: false,
          })
        )
      );
      console.log(`Notified ${recipients.length} users about new track: ${title}`);
    }

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

    if (entityName === 'Message') {
      const senderId = data.sender_id;
      const senderName = data.sender_name || 'Someone';
      const conversationId = data.conversation_id;
      const text = data.text || (data.type === 'audio' ? 'sent a voice message' : 'sent a file');

      if (!conversationId) return Response.json({ ok: true });

      // Get the conversation to find all participants
      const convos = await base44.asServiceRole.entities.Conversation.filter({ id: conversationId });
      const convo = convos[0];
      if (!convo || !convo.participant_ids) return Response.json({ ok: true });

      const recipients = convo.participant_ids.filter(id => id !== senderId);
      await Promise.all(
        recipients.map(recipientId =>
          base44.asServiceRole.entities.Notification.create({
            recipient_id: recipientId,
            type: 'comment',
            actor_id: senderId,
            actor_name: senderName,
            actor_avatar: data.sender_avatar || null,
            message: `sent you a message: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`,
            link: '/messages',
            read: false,
          })
        )
      );
      console.log(`Notified ${recipients.length} users about new message from ${senderName}`);
    }

    if (entityName === 'SharedFile') {
      const uploaderId = data.uploader_id;
      const fileName = data.name || 'a file';
      const uploaderName = data.uploader_name || 'Someone';

      const recipients = allUsers.filter(u => u.id !== uploaderId);
      await Promise.all(
        recipients.map(u =>
          base44.asServiceRole.entities.Notification.create({
            recipient_id: u.id,
            type: 'file',
            actor_id: uploaderId,
            actor_name: uploaderName,
            actor_avatar: null,
            message: `shared a new file: "${fileName}"`,
            link: '/files',
            read: false,
          })
        )
      );
      console.log(`Notified ${recipients.length} users about new file: ${fileName}`);
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('onNewContent error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});