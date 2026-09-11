import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { resolveUserSubscription } from '../../shared/subscriptionAccess.ts';
import {
  SCHEDULE_ENTITLEMENT,
  MessageConversation,
  MessageUser,
  ScheduledRecord,
  ScheduledMessageError,
  assertConversationMembership,
  getEntityOrNull,
  publicScheduledMessage,
  senderSafetyFailure,
  validateScheduleInstant,
} from '../../shared/scheduledMessages.ts';

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
    const scheduledMessageId = typeof body?.scheduled_message_id === 'string'
      ? body.scheduled_message_id
      : '';
    if (!scheduledMessageId) {
      throw new ScheduledMessageError('INVALID_SCHEDULED_MESSAGE', 'Scheduled message is required.');
    }

    const now = new Date();
    const scheduledAt = validateScheduleInstant(body?.scheduled_at, now);
    const entities = base44.asServiceRole.entities;
    const record = await getEntityOrNull<ScheduledRecord>(
      entities.ScheduledMessage,
      scheduledMessageId,
    );
    if (!record || record.sender_id !== user.id) {
      throw new ScheduledMessageError(
        'SCHEDULED_MESSAGE_NOT_FOUND',
        'Scheduled message was not found.',
        404,
      );
    }
    if (record.status !== 'scheduled') {
      throw new ScheduledMessageError(
        'SCHEDULE_STATE_CONFLICT',
        'This message is already being delivered or is no longer editable.',
        409,
      );
    }

    const access = await resolveUserSubscription(entities.Subscription, user.id, now.toISOString());
    if (!access.entitlements[SCHEDULE_ENTITLEMENT]) {
      throw new ScheduledMessageError(
        'ENTITLEMENT_REQUIRED',
        'Premium is required to reschedule messages.',
        403,
      );
    }
    const conversation = await getEntityOrNull<MessageConversation>(
      entities.Conversation,
      record.conversation_id,
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
        'You cannot reschedule this message right now.',
        403,
      );
    }

    const updated = await entities.ScheduledMessage.updateMany(
      { id: scheduledMessageId, sender_id: user.id, status: 'scheduled' },
      {
        $set: {
          scheduled_at: scheduledAt,
          dispatch_after: scheduledAt,
          updated_at: now.toISOString(),
          failure_code: null,
        },
      },
    );
    if (updated.updated !== 1) {
      throw new ScheduledMessageError(
        'SCHEDULE_STATE_CONFLICT',
        'Delivery started before the new time could be saved.',
        409,
      );
    }
    const result = await entities.ScheduledMessage.get(scheduledMessageId);
    return Response.json({ scheduled_message: publicScheduledMessage(result) });
  } catch (error) {
    if (error instanceof ScheduledMessageError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('updateScheduledMessage error:', error);
    return Response.json(
      { error: 'Unable to update the scheduled message.', code: 'SCHEDULE_UPDATE_FAILED' },
      { status: 500 },
    );
  }
}
