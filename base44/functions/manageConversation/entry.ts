import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import {
  acquireConversationMembershipLock,
  releaseConversationMembershipLock,
} from '../../shared/conversationMembershipLock.ts';

const PAGE_SIZE = 200;

async function dmConversationId(userA: string, userB: string) {
  const pair = [userA, userB].sort().join(':');
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(pair),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `dm_${hex}`;
}

function pruneReactions(reactions: unknown, participantIds: string[]) {
  if (!reactions || typeof reactions !== 'object' || Array.isArray(reactions)) return {};
  const allowed = new Set(participantIds);
  return Object.fromEntries(
    Object.entries(reactions as Record<string, unknown>).filter(([key]) => {
      const separator = key.lastIndexOf('__');
      if (separator < 0) return false;
      return allowed.has(key.slice(separator + 2));
    }),
  );
}

async function syncConversationAudience(entities: any, conversationId: string, participantIds: string[]) {
  let messageCount = 0;
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const messages = await entities.Message.filter(
      { conversation_id: conversationId },
      'created_date',
      PAGE_SIZE,
      skip,
    );
    if (messages.length === 0) break;
    await entities.Message.bulkUpdate(
      messages.map((message: any) => ({
        id: message.id,
        participant_ids: participantIds,
        read_by: Array.isArray(message.read_by)
          ? message.read_by.filter((readerId: string) => participantIds.includes(readerId))
          : [],
        reactions: pruneReactions(message.reactions, participantIds),
      })),
    );
    messageCount += messages.length;
    if (messages.length < PAGE_SIZE) break;
  }

  const typingRows: any[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await entities.TypingStatus.filter(
      { conversation_id: conversationId },
      'created_date',
      PAGE_SIZE,
      skip,
    );
    typingRows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const activeTypingRows = typingRows.filter((row: any) => participantIds.includes(row.user_id));
  const departedTypingRows = typingRows.filter((row: any) => !participantIds.includes(row.user_id));

  for (let i = 0; i < activeTypingRows.length; i += 100) {
    await entities.TypingStatus.bulkUpdate(
      activeTypingRows.slice(i, i + 100).map((row: any) => ({
        id: row.id,
        participant_ids: participantIds,
      })),
    );
  }
  for (const row of departedTypingRows) {
    await entities.TypingStatus.delete(row.id);
  }

  return { messages: messageCount, typingRows: activeTypingRows.length, removedTypingRows: departedTypingRows.length };
}

async function deleteConversationRows(entity: any, conversationId: string): Promise<number> {
  let deleted = 0;
  while (true) {
    const rows = await entity.filter(
      { conversation_id: conversationId },
      '-created_date',
      PAGE_SIZE,
    );
    if (rows.length === 0) return deleted;
    for (const row of rows) {
      await entity.delete(row.id);
      deleted += 1;
    }
    if (rows.length < PAGE_SIZE) return deleted;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

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

    if (['join_public', 'leave', 'rename'].includes(action)) {
      const mutationRate = await consumeHourlyLimit(
        entities,
        user.id,
        'conversation_membership_mutation',
        120,
      );
      if (!mutationRate.allowed) {
        return Response.json({ error: 'Conversation action rate limit exceeded. Please try again later.' }, { status: 429 });
      }
    }

    if (action === 'create_dm' || action === 'create_group') {
      if (body?.participant_ids != null && !Array.isArray(body.participant_ids)) {
        return Response.json({ error: 'participant_ids must be an array' }, { status: 400 });
      }
      const rawParticipantIds = Array.isArray(body?.participant_ids) ? body.participant_ids : [];
      if (rawParticipantIds.some((id: unknown) => typeof id !== 'string')) {
        return Response.json({ error: 'participant_ids must contain only strings' }, { status: 400 });
      }
      const requestedIds = rawParticipantIds
        .map((id: string) => id.trim())
        .filter(Boolean);
      if (requestedIds.some((id: string) => id.length > 200)) {
        return Response.json({ error: 'Invalid participant id' }, { status: 400 });
      }
      const participantIds = Array.from(new Set([user.id, ...requestedIds]));

      if (action === 'create_dm') {
        if (participantIds.length !== 2) {
          return Response.json({ error: 'A DM requires exactly two participants' }, { status: 400 });
        }
        const otherUserId = participantIds.find((id: string) => id !== user.id);
        const otherUser = otherUserId ? await entities.User.get(otherUserId).catch(() => null) : null;
        const otherIsAdmin = otherUser?.role === 'admin';
        const otherIsDiscoverable = Boolean(
          otherUser
          && otherUser.onboarding_completed
          && !otherUser.is_banned
          && String(otherUser.display_name || '').trim()
        );
        if (!otherUser || (!otherIsAdmin && !otherIsDiscoverable)) {
          // Keep missing, hidden, and ineligible accounts indistinguishable.
          return Response.json({ error: 'Recipient unavailable' }, { status: 404 });
        }
        if (user.is_banned && !otherIsAdmin) {
          return Response.json({ error: 'banned' }, { status: 403 });
        }

        const candidates = await entities.Conversation.filter(
          { type: 'dm', participant_ids: user.id },
          '-last_message_at',
          500,
        );
        const existing = candidates.find((conversation: any) => {
          const ids = Array.isArray(conversation.participant_ids) ? conversation.participant_ids : [];
          return ids.length === 2 && ids.includes(user.id) && ids.includes(otherUserId);
        });
        if (existing) return Response.json({ success: true, conversation: existing });

        const id = await dmConversationId(user.id, otherUserId);
        try {
          const conversation = await entities.Conversation.create({
            id,
            type: 'dm',
            is_public: false,
            participant_ids: participantIds,
          });
          return Response.json({ success: true, conversation });
        } catch (createError) {
          const raced = await entities.Conversation.get(id).catch(() => null);
          const racedIds = Array.isArray(raced?.participant_ids) ? raced.participant_ids : [];
          if (
            raced?.type === 'dm'
            && racedIds.length === 2
            && racedIds.includes(user.id)
            && racedIds.includes(otherUserId)
          ) {
            return Response.json({ success: true, conversation: raced, duplicate: true });
          }
          throw createError;
        }
      }

      if (participantIds.length < 2 || participantIds.length > 100) {
        return Response.json({ error: 'Groups require 2 to 100 participants' }, { status: 400 });
      }

      if (body?.name != null && typeof body.name !== 'string') {
        return Response.json({ error: 'Group name must be a string' }, { status: 400 });
      }
      const name = (body?.name || '').trim();
      if (!name) return Response.json({ error: 'Group name is required' }, { status: 400 });
      if (name.length > 120) {
        return Response.json({ error: 'Group name must be 120 characters or fewer' }, { status: 413 });
      }

      const uniqueOtherIds = participantIds.filter((id: string) => id !== user.id);
      const resolvedUsers = await Promise.all(
        uniqueOtherIds.map((id: string) => entities.User.get(id).catch(() => null)),
      );
      if (resolvedUsers.some((candidate: any) => (
        !candidate
        || (
          candidate.role !== 'admin'
          && (
            !candidate.onboarding_completed
            || candidate.is_banned
            || !String(candidate.display_name || '').trim()
          )
        )
      ))) {
        return Response.json({ error: 'One or more participants are unavailable' }, { status: 400 });
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
      const existing = await entities.Conversation.filter(
        {
          type: 'group',
          is_public: true,
          name,
        },
        '-created_date',
        1,
      );
      if (existing.length > 0) {
        const room = existing[0];
        const lockId = await acquireConversationMembershipLock(entities, room.id);
        if (!lockId) {
          return Response.json(
            { error: 'Conversation membership is being updated. Please retry.' },
            { status: 409 },
          );
        }
        try {
          const currentRoom = await entities.Conversation.get(room.id);
          if (!currentRoom) {
            return Response.json({ error: 'Conversation not found' }, { status: 404 });
          }
          const participants = Array.from(new Set([...(currentRoom.participant_ids || []), user.id]));
          if (!(currentRoom.participant_ids || []).includes(user.id)) {
            await entities.Conversation.update(currentRoom.id, { participant_ids: participants });
            await syncConversationAudience(entities, currentRoom.id, participants);
          }
          return Response.json({ success: true, conversation: { ...currentRoom, participant_ids: participants } });
        } finally {
          await releaseConversationMembershipLock(entities, lockId);
        }
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

    let membershipLockId: string | null = null;
    if (['join_public', 'leave', 'rename'].includes(action)) {
      membershipLockId = await acquireConversationMembershipLock(entities, conversationId);
      if (!membershipLockId) {
        return Response.json(
          { error: 'Conversation membership is being updated. Please retry.' },
          { status: 409 },
        );
      }
    }

    try {
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
        const [deletedMessages, deletedTypingRows] = await Promise.all([
          deleteConversationRows(entities.Message, conversation.id),
          deleteConversationRows(entities.TypingStatus, conversation.id),
        ]);
        await entities.Conversation.delete(conversation.id);
        return Response.json({
          success: true,
          deleted: true,
          deleted_messages: deletedMessages,
          deleted_typing_rows: deletedTypingRows,
        });
      }
      const updated = await entities.Conversation.update(conversation.id, { participant_ids: participantIds });
      await syncConversationAudience(entities, conversation.id, participantIds);
      return Response.json({ success: true, conversation: updated });
    }

    return Response.json({ error: 'Unsupported conversation action' }, { status: 400 });
    } finally {
      await releaseConversationMembershipLock(entities, membershipLockId);
    }
  } catch (error) {
    console.error('manageConversation error:', error);
    return Response.json({ error: error?.message || 'Conversation action failed' }, { status: 500 });
  }
});
