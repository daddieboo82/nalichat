import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sendPushToUser } from '../../shared/webPush.ts';
import { workflowEntityRecordId } from '../../shared/workflowEvents.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    const record = workflowEntityRecordId({ event, data });
    if (record.conflict) return Response.json({ error: 'Conflicting entity ids' }, { status: 400 });
    if (event?.type !== 'create' || !record.id) return Response.json({ success: true });

    const entities = base44.asServiceRole.entities;
    const message = await entities.Message.get(record.id);
    if (!message?.conversation_id) return Response.json({ success: true });

    const conversation = await entities.Conversation.get(message.conversation_id);
    if (!conversation) return Response.json({ success: true });

    let callSignal = null;
    if (message.type === 'session' && typeof message.text === 'string') {
      try {
        const parsed = JSON.parse(message.text);
        if (parsed?.__nalichat_call__ === true) callSignal = parsed;
      } catch {}
    }
    if (callSignal && callSignal.type !== 'offer') {
      return Response.json({ success: true, count: 0, signaling: true });
    }

    const recipients = new Set<string>();
    for (const id of conversation.participant_ids || []) {
      if (id !== message.sender_id) recipients.add(id);
    }

    let created = 0;
    for (const recipientId of recipients) {
      const notification = {
        id: `notification_message_${message.id}_${recipientId}`,
        recipient_id: recipientId,
        type: "message",
        actor_id: message.sender_id,
        actor_name: message.sender_name || "Someone",
        actor_avatar: message.sender_avatar,
        message: callSignal
          ? `Incoming ${callSignal.callType === 'video' ? 'video' : 'audio'} call`
          : conversation.type === 'group'
            ? `sent a message in ${conversation.name || 'a group'}: "${message.text ? message.text.substring(0, 30) + (message.text.length > 30 ? '...' : '') : 'an attachment'}"`
            : `${message.text ? message.text.substring(0, 60) + (message.text.length > 60 ? '...' : '') : 'Sent you an attachment'}`,
        link: `/messages?id=${conversation.id}`,
      };
      try {
        await entities.Notification.create(notification);
        created += 1;
        await sendPushToUser(entities, recipientId, {
          title: notification.actor_name || 'NaliChat',
          body: notification.message,
          url: notification.link,
        });
      } catch {
        // Deterministic ID makes repeated workflow/manual invocations idempotent.
      }
    }

    return Response.json({ success: true, count: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
