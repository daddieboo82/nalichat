import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = String(body?.action || '');
    const entities = base44.asServiceRole.entities;

    if (action === 'add') {
      const targetUserId = String(body?.targetUserId || '');
      if (!targetUserId || targetUserId === user.id) {
        return Response.json({ error: 'Invalid contact target' }, { status: 400 });
      }

      const target = await entities.User.get(targetUserId).catch(() => null);
      if (!target || !target.onboarding_completed || target.is_banned) {
        // Keep missing/private/ineligible targets indistinguishable.
        return Response.json({ error: 'Contact is unavailable' }, { status: 404 });
      }

      const existing = await entities.Contact.filter({
        user_id: user.id,
        contact_user_id: target.id,
      });
      if (existing.length > 0) {
        return Response.json({ success: true, contact: existing[0], existing: true });
      }

      const contact = await entities.Contact.create({
        user_id: user.id,
        contact_user_id: target.id,
        contact_name: target.display_name || target.full_name || 'NaliChat User',
        contact_avatar: target.avatar_url || null,
      });
      return Response.json({ success: true, contact, existing: false });
    }

    if (action === 'delete') {
      const contactId = String(body?.contactId || '');
      if (!contactId) return Response.json({ error: 'contactId is required' }, { status: 400 });
      const contact = await entities.Contact.get(contactId).catch(() => null);
      if (!contact || contact.user_id !== user.id) {
        return Response.json({ error: 'Contact not found' }, { status: 404 });
      }
      await entities.Contact.delete(contact.id);
      return Response.json({ success: true, deleted: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('mutateContact error:', error);
    return Response.json({ error: error?.message || 'Contact mutation failed' }, { status: 500 });
  }
});
