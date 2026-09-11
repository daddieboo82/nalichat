import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendPushToUser } from '../../shared/webPush.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    
    if (event.type !== 'create') return Response.json({ success: true });
    if (!data.conversation_id) return Response.json({ success: true });
    
    // Get conversation to find participants
    const conversation = await base44.asServiceRole.entities.Conversation.get(data.conversation_id);
    if (!conversation) return Response.json({ success: true });
    
    // Notify every other participant for both DMs and group chats.
    // The workflow triggers for all Message records, so filtering out DMs here
    // caused one-to-one messages to produce no notification at all.
    
    // Determine recipients
    const recipients = new Set();
    if (conversation.participant_ids) {
      conversation.participant_ids.forEach(id => {
        if (id !== data.sender_id) recipients.add(id);
      });
    }
    
    const notifications = Array.from(recipients).map(recipient_id => ({
      recipient_id,
      type: "message",
      actor_id: data.sender_id,
      actor_name: data.sender_name || "Someone",
      actor_avatar: data.sender_avatar,
      message: conversation.type === 'group'
        ? `sent a message in ${conversation.name || 'a group'}: "${data.text ? data.text.substring(0, 30) + (data.text.length > 30 ? '...' : '') : 'an attachment'}"`
        : `${data.text ? data.text.substring(0, 60) + (data.text.length > 60 ? '...' : '') : 'Sent you an attachment'}`,
      link: `/messages?id=${conversation.id}`
    }));
    
    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
      await Promise.all(notifications.map((notification) =>
        sendPushToUser(base44.asServiceRole.entities, notification.recipient_id, {
          title: notification.actor_name || 'NaliChat',
          body: notification.message,
          url: notification.link,
        })
      ));
    }
    
    return Response.json({ success: true, count: notifications.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});