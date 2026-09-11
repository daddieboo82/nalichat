import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  ScheduledMessageError,
  ScheduledRecord,
  cancelScheduledRecord,
  getEntityOrNull,
  publicScheduledMessage,
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

    const entities = base44.asServiceRole.entities;
    let record = await getEntityOrNull<ScheduledRecord>(
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
    if (record.status === 'canceled') {
      return Response.json({ scheduled_message: publicScheduledMessage(record) });
    }
    if (record.status !== 'scheduled') {
      throw new ScheduledMessageError(
        'SCHEDULE_STATE_CONFLICT',
        'This message is already being delivered or can no longer be canceled.',
        409,
      );
    }

    const canceled = await cancelScheduledRecord(
      entities.ScheduledMessage,
      scheduledMessageId,
      user.id,
      new Date(),
    );
    if (!canceled) {
      throw new ScheduledMessageError(
        'SCHEDULE_STATE_CONFLICT',
        'Delivery started before cancellation completed.',
        409,
      );
    }
    record = await entities.ScheduledMessage.get(scheduledMessageId);
    return Response.json({ scheduled_message: publicScheduledMessage(record) });
  } catch (error) {
    if (error instanceof ScheduledMessageError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('cancelScheduledMessage error:', error);
    return Response.json(
      { error: 'Unable to cancel the scheduled message.', code: 'SCHEDULE_CANCEL_FAILED' },
      { status: 500 },
    );
  }
}
