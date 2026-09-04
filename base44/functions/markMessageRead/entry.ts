import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Marks a message as read by the current user using the service role
// (bypasses RLS — the sender owns the message, so the reader can't
// update it directly).  Idempotent: adds the user ID only if not already
// present in read_by.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message_id } = await req.json();
    if (!message_id) {
      return Response.json({ error: 'message_id is required' }, { status: 400 });
    }

    const message = await base44.asServiceRole.entities.Message.get(message_id);
    if (!message) {
      return Response.json({ error: 'Message not found' }, { status: 404 });
    }

    // Don't mark your own messages as read
    if (message.sender_id === user.id) {
      return Response.json({ success: true, alreadyRead: true });
    }

    const readBy = Array.isArray(message.read_by) ? message.read_by : [];
    if (readBy.includes(user.id)) {
      return Response.json({ success: true, alreadyRead: true });
    }

    await base44.asServiceRole.entities.Message.update(message_id, {
      read_by: [...readBy, user.id],
    });

    return Response.json({ success: true, alreadyRead: false });
  } catch (error) {
    console.error('markMessageRead error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});