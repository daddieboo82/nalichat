import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  buildAuthorizedChatExport,
  ChatExportError,
} from '../../shared/chatExport.ts';

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

    const body = req.method === 'GET' ? {} : await req.json();
    const conversationId = typeof body?.conversation_id === 'string'
      ? body.conversation_id.trim()
      : '';
    const exportData = await buildAuthorizedChatExport({
      entities: base44.asServiceRole.entities,
      user,
      conversationId,
    });

    return Response.json(exportData);
  } catch (error) {
    if (error instanceof ChatExportError) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error('exportConversation error:', error);
    const message = error instanceof Error ? error.message : 'Unable to export conversation';
    return Response.json({ error: message, code: 'EXPORT_FAILED' }, { status: 500 });
  }
});
