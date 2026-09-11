import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  ScheduledMessageError,
  MessageConversation,
  assertConversationMembership,
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

    const body = await req.json().catch(() => ({}));
    const conversationId = typeof body?.conversation_id === 'string'
      ? body.conversation_id
      : null;
    const entities = base44.asServiceRole.entities;
    if (conversationId) {
      const conversation = await getEntityOrNull<MessageConversation>(
        entities.Conversation,
        conversationId,
      );
      assertConversationMembership(user.id, conversation);
    }

    const query = {
      sender_id: user.id,
      ...(conversationId ? { conversation_id: conversationId } : {}),
    };
    const active = await entities.ScheduledMessage.filter(
      {
        ...query,
        status: ['scheduled', 'processing'],
      },
      'scheduled_at',
      25,
    );
    const history = await entities.ScheduledMessage.filter(
      {
        ...query,
        status: ['sent', 'canceled', 'failed'],
      },
      '-updated_at',
      75,
    );
    return Response.json({
      scheduled_messages: [...active, ...history].map(publicScheduledMessage),
    });
  } catch (error) {
    if (error instanceof ScheduledMessageError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('listScheduledMessages error:', error);
    return Response.json(
      { error: 'Unable to load scheduled messages.', code: 'SCHEDULE_LIST_FAILED' },
      { status: 500 },
    );
  }
}
