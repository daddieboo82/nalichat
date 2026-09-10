import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  executeMessageSearch,
  MessageSearchError,
} from '../../shared/messageSearch.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const result = await executeMessageSearch({
      conversationEntity: base44.asServiceRole.entities.Conversation,
      messageEntity: base44.asServiceRole.entities.Message,
      subscriptionEntity: base44.asServiceRole.entities.Subscription,
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
