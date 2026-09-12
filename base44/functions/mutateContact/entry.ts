import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';

async function contactRecordId(userId: string, targetUserId: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${userId}:${targetUserId}`),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `contact_${hex}`;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const writeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'contact_mutation',
      120,
    );
    if (!writeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 16 * 1024);
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

      const existing = await entities.Contact.filter(
        {
          user_id: user.id,
          contact_user_id: target.id,
        },
        '-created_date',
        1,
      );
      if (existing.length > 0) {
        return Response.json({ success: true, contact: existing[0], existing: true });
      }

      const deterministicId = await contactRecordId(user.id, target.id);
      try {
        const contact = await entities.Contact.create({
          id: deterministicId,
          user_id: user.id,
          contact_user_id: target.id,
          contact_name: target.display_name || target.full_name || 'NaliChat User',
          contact_avatar: target.avatar_url || null,
        });
        return Response.json({ success: true, contact, existing: false });
      } catch (createError) {
        const raced = await entities.Contact.get(deterministicId).catch(() => null);
        if (raced?.user_id === user.id && raced?.contact_user_id === target.id) {
          return Response.json({ success: true, contact: raced, existing: true });
        }
        throw createError;
      }
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
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('mutateContact error:', error);
    return Response.json({ error: 'Contact mutation failed' }, { status: 500 });
  }
});
