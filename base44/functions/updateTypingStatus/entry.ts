import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const conversationId = String(body?.conversationId || '');
    const action = String(body?.action || 'heartbeat');
    if (!conversationId || !['heartbeat', 'clear'].includes(action)) {
      return Response.json({ error: 'Valid conversationId and action are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const conversation = await entities.Conversation.get(conversationId);
    if (!conversation) return Response.json({ error: 'Conversation not found' }, { status: 404 });
    const participantIds = Array.isArray(conversation.participant_ids) ? conversation.participant_ids : [];
    if (!participantIds.includes(user.id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await entities.TypingStatus.filter({
      conversation_id: conversation.id,
      user_id: user.id,
    });
    const row = existing[0] || null;

    if (action === 'clear') {
      for (const item of existing) await entities.TypingStatus.delete(item.id);
      return Response.json({ success: true, cleared: existing.length });
    }

    const payload = {
      conversation_id: conversation.id,
      user_id: user.id,
      user_name: user.display_name || user.full_name || 'Someone',
      participant_ids: participantIds,
      last_typed_at: new Date().toISOString(),
    };

    const updated = row
      ? await entities.TypingStatus.update(row.id, payload)
      : await entities.TypingStatus.create(payload);

    // Collapse duplicate legacy rows if they exist.
    for (const duplicate of existing.slice(1)) {
      await entities.TypingStatus.delete(duplicate.id);
    }

    return Response.json({ success: true, typing: updated });
  } catch (error) {
    console.error('updateTypingStatus error:', error);
    return Response.json({ error: error?.message || 'Typing status update failed' }, { status: 500 });
  }
});
