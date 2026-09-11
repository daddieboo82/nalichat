import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { moderateMessageText } from '../../shared/messageModeration.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, conversation_id, message_id } = await req.json();
    if (!text || !text.trim()) {
      return Response.json({ flagged: false });
    }

    const result = await moderateMessageText({
      text,
      user,
      conversationId: conversation_id,
      messageId: message_id,
      dependencies: {
        integrations: base44.asServiceRole.integrations,
        entities: base44.asServiceRole.entities,
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error("moderateContent error:", error);
    const message = error instanceof Error ? error.message : 'Moderation failed';
    return Response.json({ error: message }, { status: 500 });
  }
});