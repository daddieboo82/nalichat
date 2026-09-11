import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { isConversationMember, lockedNotification } from '../../shared/lockedChats.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    
    if (event.type !== 'create') return Response.json({ success: true });
    if (!data.conversation_id) return Response.json({ success: true });
    
    // Get conversation to find participants
    const conversation = await base44.asServiceRole.entities.Conversation.get(data.conversation_id);
    if (!conversation) return Response.json({ success: true });
    if (!isConversationMember(conversation, data.sender_id)) {
      return Response.json({ error: 'Message sender is not a conversation member' }, { status: 403 });
    }
    
    // Determine recipients
    const recipients = new Set();
    if (conversation.participant_ids) {
      conversation.participant_ids.forEach(id => {
        if (id !== data.sender_id) recipients.add(id);
      });
    }
    
    const notifications = await Promise.all(Array.from(recipients).map(async (recipient_id) => {
      const preferences = await base44.asServiceRole.entities.LockedConversationPreference.filter(
        { user_id: recipient_id, conversation_id: conversation.id },
        '-created_date',
        1,
      );
      const base = {
        recipient_id,
        type: "message",
        actor_id: data.sender_id,
        conversation_id: conversation.id,
      };
      if (preferences.length > 0) {
        return { ...base, ...lockedNotification(conversation.id) };
      }
      return {
        ...base,
        locked_chat: false,
        actor_name: data.sender_name || "Someone",
        actor_avatar: data.sender_avatar,
        message: `sent a message in ${conversation.name || 'a chat'}: "${data.text ? data.text.substring(0, 30) + (data.text.length > 30 ? '...' : '') : 'an attachment'}"`,
        link: `/messages?id=${conversation.id}`,
      };
    }));
    
    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    }
    
    return Response.json({ success: true, count: notifications.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});