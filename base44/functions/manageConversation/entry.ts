import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

async function syncConversationAudience(entities: any, conversationId: string, participantIds: string[]) {
  const [messages, typingRows] = await Promise.all([
    entities.Message.filter({ conversation_id: conversationId }),
    entities.TypingStatus.filter({ conversation_id: conversationId }),
  ]);

  for (let i = 0; i < messages.length; i += 100) {
    await entities.Message.bulkUpdate(
      messages.slice(i, i + 100).map((message: any) => ({
        id: message.id,
        participant_ids: participantIds,
        read_by: Array.isArray(message.read_by)
          ? message.read_by.filter((readerId: string) => participantIds.includes(readerId))
          : [],
      })),
    );
  }

  for (let i = 0; i < typingRows.length; i += 100) {
    await entities.TypingStatus.bulkUpdate(
      typingRows.slice(i, i + 100).map((row: any) => ({
        id: row.id,
        participant_ids: participantIds,
      })),
    );
  }

  return { messages: messages.length, typingRows: typingRows.length };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body?.action;
    const entities = base44.asServiceRole.entities;

    const timeoutActive = user.timeout_until && new Date(user.timeout_until).getTime() > Date.now();
    if (timeoutActive && ['create_dm', 'create_group', 'create_public', 'join_public', 'rename'].includes(action)) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    if (user.is_banned && ['create_group', 'create_public', 'join_public', 'rename'].includes(action)) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }

    if (['create_dm', 'create_group', 'create_public'].includes(action)) {
      const rate = await consumeHourlyLimit(entities, user.id, 'conversation_create', 60);
      if (!rate.allowed) {
        return Response.json({ error: 'Conversation creation rate limit exceeded. Please try again later.' }, { status: 429 });
      }
    }

    if (action === 'create_dm' || action === 'create_group') {
      const rawParticipantIds = Array.isArray(body?.participant_ids) ? body.participant_ids : [];
      const requestedIds = rawParticipantIds
        .map((id: unknown) => String(id || '').trim())
        .filter(Boolean);
      const participantIds = Array.from(new Set([user.id, ...requestedIds]));

      if (action === 'create_dm') {
        if (participantIds.length !== 2) {
          return Response.json({ error: 'A DM requires exactly two participants' }, { status: 400 });
        }
        const otherUserId = participantIds.find((id: string) => id !== user.id);
        const otherUser = otherUserId ? await entities.User.get(otherUserId).catch(() => null) : null;
        if (!otherUser) return Response.json({ error: 'Recipient not found' }, { status: 404 });
        if (user.is_banned && otherUser.role !== 'admin') {
          return Response.json({ error: 'banned' }, { status: 403 });
        }

        const candidates = await entities.Conversation.filter({ type: 'dm' });
        const existing = candidates.find((conversation: any) => {
          const ids = Array.isArray(conversation.participant_ids) ? conversation.participant_ids : [];
          return ids.length === 2 && ids.includes(user.id) && ids.includes(otherUserId);
        });
        if (existing) return Response.json({ success: true, conversation: existing });

        const conversation = await entities.Conversation.create({
          type: 'dm',
          is_public: false,
          participant_ids: participantIds,
        });
        return Response.json({ success: true, conversation });
      }

      if (participantIds.length < 2 || participantIds.length > 100) {
        return Response.json({ error: 'Groups require 2 to 100 participants' }, { status: 400 });
      }

      const name = String(body?.name || '').trim().slice(0, 120);
      if (!name) return Response.json({ error: 'Group name is required' }, { status: 400 });

      const uniqueOtherIds = participantIds.filter((id: string) => id !== user.id);
      const resolvedUsers = await Promise.all(
        uniqueOtherIds.map((id: string) => entities.User.get(id).catch(() => null)),
      );
      if (resolvedUsers.some((candidate: any) => !candidate)) {
        return Response.json({ error: 'One or more participants were not found' }, { status: 400 });
      }

      const conversation = await entities.Conversation.create({
        type: 'group',
        name,
        is_public: false,
        participant_ids: participantIds,
      });
      return Response.json({ success: true, conversation });
    }

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
          await syncConversationAudience(entities, room.id, participants);
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
      await syncConversationAudience(entities, conversation.id, participantIds);
      return Response.json({ success: true, conversation: updated });
    }

    if (!isParticipant) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (action === 'rename') {
      if (conversation.type !== 'group') {
        return Response.json({ error: 'Only group conversations can be renamed' }, { status: 400 });
      }
      if (conversation.is_public === true && user.role !== 'admin') {
        return Response.json({ error: 'Only an admin can rename a public room' }, { status: 403 });
      }
      const name = String(body?.name || '').trim().slice(0, 120);
      if (!name) return Response.json({ error: 'Group name is required' }, { status: 400 });
      const updated = await entities.Conversation.update(conversation.id, { name });
      return Response.json({ success: true, conversation: updated });
    }

    if (action === 'leave') {
      const participantIds = (conversation.participant_ids || []).filter((id: string) => id !== user.id);
      if (participantIds.length === 0) {
        const [messages, typingRows] = await Promise.all([
          entities.Message.filter({ conversation_id: conversation.id }),
          entities.TypingStatus.filter({ conversation_id: conversation.id }),
        ]);
        for (const message of messages) await entities.Message.delete(message.id);
        for (const typing of typingRows) await entities.TypingStatus.delete(typing.id);
        await entities.Conversation.delete(conversation.id);
        return Response.json({
          success: true,
          deleted: true,
          deleted_messages: messages.length,
          deleted_typing_rows: typingRows.length,
        });
      }
      const updated = await entities.Conversation.update(conversation.id, { participant_ids: participantIds });
      await syncConversationAudience(entities, conversation.id, participantIds);
      return Response.json({ success: true, conversation: updated });
    }

    return Response.json({ error: 'Unsupported conversation action' }, { status: 400 });
  } catch (error) {
    console.error('manageConversation error:', error);
    return Response.json({ error: error?.message || 'Conversation action failed' }, { status: 500 });
  }
});
