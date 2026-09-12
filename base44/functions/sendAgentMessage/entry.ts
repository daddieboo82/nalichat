import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import {
  AiQuotaError,
  aiQuotaErrorResponse,
} from '../../shared/aiQuota.ts';
import {
  AiCapabilityError,
  aiCapabilityErrorResponse,
  executeRoutedAiRequest,
} from '../../shared/aiCapability.ts';
import { requireEntitlement } from '../../shared/entitlementAccess.ts';

const MAX_AGENT_MESSAGE_CHARS = 12_000;
const MAX_CONVERSATION_ID_CHARS = 256;

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json(
        { error: 'timed_out', timeout_until: user.timeout_until },
        { status: 403 },
      );
    }

    const { allowed, entitlements } = await requireEntitlement(
      base44.asServiceRole.entities,
      user.id,
      'ai.standard',
    );
    if (!allowed) {
      return Response.json(
        { error: 'Premium is required to use NALI.ai', code: 'AI_NOT_ENTITLED' },
        { status: 403 },
      );
    }

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
    if (conversationId.length > MAX_CONVERSATION_ID_CHARS) {
      return Response.json({ error: 'Invalid conversation id.' }, { status: 400 });
    }
    if (content.length > MAX_AGENT_MESSAGE_CHARS) {
      return Response.json(
        { error: 'Assistant message is too long.' },
        { status: 413 },
      );
    }

    const conversation = await base44.agents.getConversation(conversationId);
    if (!conversation || conversation.created_by_id !== user.id) {
      return Response.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    if (conversation.agent_name !== 'studio_ai' && conversation.agent_name !== 'studio_ai_plus') {
      return Response.json({ error: 'Unsupported assistant conversation.' }, { status: 400 });
    }
    if (conversation.agent_name === 'studio_ai_plus' && !entitlements['ai.best_model']) {
      return Response.json(
        { error: 'Premium Plus is required for NALI.ai Plus', code: 'AI_BEST_MODEL_NOT_ENTITLED' },
        { status: 403 },
      );
    }

    const { result, quota } = await executeRoutedAiRequest<Record<string, unknown>>({
      base44,
      user,
      operation: 'assistant',
      requestKey: body?.request_key,
      requestBody: body,
      readEnvironment: (name) => secrets.get(name),
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
