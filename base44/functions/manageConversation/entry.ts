import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body?.action;
    const entities = base44.asServiceRole.entities;

    if (action === 'create_public') {
      const name = String(body?.name || '').trim().slice(0, 120);
      if (!name.startsWith('#') || name.length < 2) {
        return Response.json({ error: 'Public room names must start with #' }, { status: 400 });
      }
      const existing = await entities.Conversation.filter({
        type: 'group',
        is_public: true,
        name,
      });
      if (existing.length > 0) {
        const room = existing[0];
        const participants = Array.from(new Set([...(room.participant_ids || []), user.id]));
        if (!(room.participant_ids || []).includes(user.id)) {
          await entities.Conversation.update(room.id, { participant_ids: participants });
        }
        return Response.json({ success: true, conversation: { ...room, participant_ids: participants } });
      }

      const conversation = await entities.Conversation.create({
        name,
        type: 'group',
        is_public: true,
        participant_ids: [user.id],
      });
      return Response.json({ success: true, conversation });
    }

    const conversationId = String(body?.conversationId || '');
    if (!conversationId) {
      return Response.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const conversation = await entities.Conversation.get(conversationId);
    if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });

    const isParticipant = Array.isArray(conversation.participant_ids)
      && conversation.participant_ids.includes(user.id);

    if (action === 'join_public') {
      if (conversation.type !== 'group' || conversation.is_public !== true) {
        return Response.json({ error: 'This group is not public' }, { status: 403 });
      }
      const participantIds = Array.from(new Set([...(conversation.participant_ids || []), user.id]));
      const updated = await entities.Conversation.update(conversation.id, { participant_ids: participantIds });
      return Response.json({ success: true, conversation: updated });
    }

    if (!isParticipant) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (action === 'rename') {
      if (conversation.type !== 'group') {
        return Response.json({ error: 'Only group conversations can be renamed' }, { status: 400 });
      }
      const name = String(body?.name || '').trim().slice(0, 120);
      if (!name) return Response.json({ error: 'Group name is required' }, { status: 400 });
      const updated = await entities.Conversation.update(conversation.id, { name });
      return Response.json({ success: true, conversation: updated });
    }

    if (action === 'leave') {
      const participantIds = (conversation.participant_ids || []).filter((id: string) => id !== user.id);
      if (participantIds.length === 0) {
        await entities.Conversation.delete(conversation.id);
        return Response.json({ success: true, deleted: true });
      }
      const updated = await entities.Conversation.update(conversation.id, { participant_ids: participantIds });
      return Response.json({ success: true, conversation: updated });
    }

    return Response.json({ error: 'Unsupported conversation action' }, { status: 400 });
  } catch (error) {
    console.error('manageConversation error:', error);
    return Response.json({ error: error?.message || 'Conversation action failed' }, { status: 500 });
  }
});
