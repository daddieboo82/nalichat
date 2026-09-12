import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  executeMessageSearch,
  MessageSearchError,
} from '../../shared/messageSearch.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const searchRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'message_search',
      300,
    );
    if (!searchRate.allowed) {
      return Response.json(
        { error: 'Message search rate limit exceeded. Please try again later.', code: 'RATE_LIMITED' },
        { status: 429 },
      );
    }

    const body = await req.json();
    const result = await executeMessageSearch({
      conversationEntity: base44.asServiceRole.entities.Conversation,
      messageEntity: base44.asServiceRole.entities.Message,
      entities: base44.asServiceRole.entities,
    }, body, user.id);

    return Response.json(result);
  } catch (error) {
    if (error instanceof MessageSearchError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error('searchMessages error:', error);
    return Response.json(
      { error: 'Unable to search messages', code: 'MESSAGE_SEARCH_FAILED' },
      { status: 500 },
    );
  }
});
