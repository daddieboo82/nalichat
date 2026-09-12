import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function inviteLookupScope(req: Request, viewerId?: string): Promise<string> {
  if (viewerId) return `squad_invite_user_${viewerId}`;
  const forwarded = String(
    req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')
    || '',
  ).split(',')[0].trim().slice(0, 128);
  const userAgent = String(req.headers.get('user-agent') || '').slice(0, 256);
  return 'squad_invite_anon_' + await sha256Hex(`${forwarded || 'unknown'}:${userAgent || 'unknown'}`);
}

function isInviteExpired(squad: any) {
  const raw = squad?.invite_expires_at || squad?.created_date;
  if (!raw) return false;
  const base = Date.parse(raw);
  if (Number.isNaN(base)) return false;
  const expiry = squad?.invite_expires_at ? base : base + 7 * 24 * 60 * 60 * 1000;
  return expiry <= Date.now();
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
    const base44 = createClientFromRequest(req);
    const viewer = await base44.auth.me().catch(() => null);
    const { inviteCode } = await readJsonBodyLimited(req, 8 * 1024);
    const normalizedCode = String(inviteCode || '').trim().toUpperCase();
    if (!/^[0-9A-F]{24}$/.test(normalizedCode)) {
      return Response.json({ error: 'Invalid invite code' }, { status: 400 });
    }

    const lookupScope = await inviteLookupScope(req, viewer?.id);
    const lookupRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      lookupScope,
      'squad_invite_lookup',
      120,
    );
    if (!lookupRate.allowed) {
      return Response.json(
        { error: 'Too many invite lookups. Please try again later.' },
        { status: 429 },
      );
    }

    const squads = await base44.asServiceRole.entities.Squad.filter(
      { invite_code: normalizedCode },
      '-created_date',
      1,
    );
    const squad = squads[0];
    if (!squad || squad.status === 'ended' || isInviteExpired(squad)) {
      return Response.json({ error: 'Invite not found' }, { status: 404 });
    }

    // Public-safe projection only.
    return Response.json({
      squad: {
        member_a_name: squad.member_a_name,
        status: squad.status,
        is_full: Boolean(squad.member_b_id) || squad.status === 'active',
        is_own_invite: Boolean(viewer?.id && squad.member_a_id === viewer.id),
      },
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    return Response.json({ error: 'Could not load squad invite' }, { status: 500 });
  }
});
