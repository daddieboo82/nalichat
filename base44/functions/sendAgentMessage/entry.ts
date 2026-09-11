import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  AiQuotaError,
  aiQuotaErrorResponse,
} from '../../shared/aiQuota.ts';
import {
  AiCapabilityError,
  aiCapabilityErrorResponse,
  executeRoutedAiRequest,
} from '../../shared/aiCapability.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const conversationId = typeof body?.conversation_id === 'string'
      ? body.conversation_id.trim()
      : '';
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    if (!conversationId || !content) {
      return Response.json(
        { error: 'Conversation and message content are required.' },
        { status: 400 },
      );
    }

    const conversation = await base44.agents.getConversation(conversationId);
    if (!conversation || conversation.created_by_id !== user.id) {
      return Response.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    const { result, quota } = await executeRoutedAiRequest<Record<string, unknown>>({
      base44,
      user,
      operation: 'assistant',
      requestKey: body?.request_key,
      requestBody: body,
      readEnvironment: (name) => Deno.env.get(name),
      supportsDeepMode: false,
      dispatch: () => base44.agents.addMessage(conversation, {
        role: 'user',
        content,
      }),
    });

    return Response.json({ message: result, quota });
  } catch (error) {
    if (error instanceof AiCapabilityError) return aiCapabilityErrorResponse(error);
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    console.error('sendAgentMessage error:', error);
    return Response.json({ error: 'Unable to send assistant message.' }, { status: 500 });
  }
});
