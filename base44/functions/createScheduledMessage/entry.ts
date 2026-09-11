import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { resolveUserSubscription } from '../../shared/subscriptionAccess.ts';
import {
  SCHEDULE_ENTITLEMENT,
  MAX_ACTIVE_SCHEDULES_PER_USER,
  MessageConversation,
  MessageUser,
  ScheduledMessageError,
  acquireScheduledCreateLease,
  assertConversationMembership,
  getEntityOrNull,
  normalizeScheduleInstant,
  publicScheduledMessage,
  releaseScheduledCreateLease,
  renewScheduledCreateLease,
  requestsMatch,
  sanitizeScheduledPayload,
  senderSafetyFailure,
  validateClientRequestKey,
  validateScheduleInstant,
} from '../../shared/scheduledMessages.ts';

function errorResponse(error: unknown) {
  if (error instanceof ScheduledMessageError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error('createScheduledMessage error:', error);
  return Response.json(
    { error: 'Unable to schedule the message.', code: 'SCHEDULE_CREATE_FAILED' },
    { status: 500 },
  );
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return Response.json(
        { error: 'Authentication required.', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const conversationId = typeof body?.conversation_id === 'string'
      ? body.conversation_id
      : '';
    if (!conversationId) {
      throw new ScheduledMessageError('INVALID_CONVERSATION', 'Conversation is required.');
    }

    const payload = sanitizeScheduledPayload(body?.payload);
    const scheduledAt = normalizeScheduleInstant(body?.scheduled_at);
    const clientRequestKey = validateClientRequestKey(body?.client_request_key);
    const entities = base44.asServiceRole.entities;
    let existing = await entities.ScheduledMessage.filter(
      { sender_id: user.id, client_request_key: clientRequestKey },
      '-created_date',
      2,
    );
    if (existing.length) {
      if (!requestsMatch(existing[0], conversationId, payload, scheduledAt)) {
        throw new ScheduledMessageError(
          'IDEMPOTENCY_CONFLICT',
          'This request key was already used for a different scheduled message.',
          409,
        );
      }
      return Response.json({
        scheduled_message: publicScheduledMessage(existing[0]),
        idempotent_replay: true,
      });
    }

    const now = new Date();
    validateScheduleInstant(scheduledAt, now);
    const access = await resolveUserSubscription(entities.Subscription, user.id, now.toISOString());
    if (!access.entitlements[SCHEDULE_ENTITLEMENT]) {
      throw new ScheduledMessageError(
        'ENTITLEMENT_REQUIRED',
        'Premium is required to schedule messages.',
        403,
      );
    }

    const conversation = await getEntityOrNull<MessageConversation>(
      entities.Conversation,
      conversationId,
    );
    assertConversationMembership(user.id, conversation);
    const participantUsers = (await Promise.all(
      (conversation.participant_ids || []).map((id: string) => (
        getEntityOrNull<MessageUser>(entities.User, id)
      )),
    )).filter(Boolean);
    const safetyFailure = senderSafetyFailure(user, conversation, participantUsers, now);
    if (safetyFailure) {
      throw new ScheduledMessageError(
        safetyFailure,
        safetyFailure === 'SENDER_TIMED_OUT'
          ? 'You are timed out and cannot schedule messages right now.'
          : 'You cannot schedule a message to this conversation.',
        403,
      );
    }

    const claimToken = crypto.randomUUID();
    const acquired = await acquireScheduledCreateLease(
      entities.User,
      user.id,
      claimToken,
      now,
    );
    if (!acquired) {
      existing = await entities.ScheduledMessage.filter(
        { sender_id: user.id, client_request_key: clientRequestKey },
        '-created_date',
        2,
      );
      if (existing.length && requestsMatch(existing[0], conversationId, payload, scheduledAt)) {
        return Response.json({
          scheduled_message: publicScheduledMessage(existing[0]),
          idempotent_replay: true,
        });
      }
      throw new ScheduledMessageError(
        'SCHEDULE_CREATE_IN_PROGRESS',
        'Another schedule request is in progress. Retry this request.',
        409,
      );
    }

    let created;
    try {
      existing = await entities.ScheduledMessage.filter(
        { sender_id: user.id, client_request_key: clientRequestKey },
        '-created_date',
        2,
      );
      if (existing.length) {
        if (!requestsMatch(existing[0], conversationId, payload, scheduledAt)) {
          throw new ScheduledMessageError(
            'IDEMPOTENCY_CONFLICT',
            'This request key was already used for a different scheduled message.',
            409,
          );
        }
        return Response.json({
          scheduled_message: publicScheduledMessage(existing[0]),
          idempotent_replay: true,
        });
      }

      const activeSchedules = await entities.ScheduledMessage.filter(
        { sender_id: user.id, status: ['scheduled', 'processing'] },
        'scheduled_at',
        MAX_ACTIVE_SCHEDULES_PER_USER,
      );
      if (activeSchedules.length >= MAX_ACTIVE_SCHEDULES_PER_USER) {
        throw new ScheduledMessageError(
          'ACTIVE_SCHEDULE_LIMIT',
          `You can have up to ${MAX_ACTIVE_SCHEDULES_PER_USER} active scheduled messages.`,
          409,
        );
      }

      const ownsLease = await renewScheduledCreateLease(
        entities.User,
        user.id,
        claimToken,
        new Date(),
      );
      if (!ownsLease) {
        throw new ScheduledMessageError(
          'SCHEDULE_CREATE_IN_PROGRESS',
          'Another schedule request won the create lease. Retry this request.',
          409,
        );
      }
      const nowIso = now.toISOString();
      created = await entities.ScheduledMessage.create({
        sender_id: user.id,
        conversation_id: conversationId,
        payload,
        scheduled_at: scheduledAt,
        dispatch_after: scheduledAt,
        status: 'scheduled',
        client_request_key: clientRequestKey,
        created_at: nowIso,
        updated_at: nowIso,
        attempt_count: 0,
        preview_pending: false,
      });
    } finally {
      await releaseScheduledCreateLease(entities.User, user.id, claimToken);
    }

    return Response.json(
      { scheduled_message: publicScheduledMessage(created), idempotent_replay: false },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
