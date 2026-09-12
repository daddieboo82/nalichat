import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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
    const { inviteCode } = await req.json();
    const normalizedCode = String(inviteCode || '').trim().toUpperCase();
    if (!/^[0-9A-F]{24}$/.test(normalizedCode)) {
      return Response.json({ error: 'Invalid invite code' }, { status: 400 });
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
    return Response.json({ error: error?.message || 'Could not load squad invite' }, { status: 500 });
  }
});
