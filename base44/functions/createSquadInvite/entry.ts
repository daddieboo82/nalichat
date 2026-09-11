import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

function isInviteExpired(squad: any) {
  const raw = squad?.invite_expires_at || squad?.created_date;
  if (!raw) return false;
  const base = Date.parse(raw);
  if (Number.isNaN(base)) return false;
  const expiry = squad?.invite_expires_at ? base : base + 7 * 24 * 60 * 60 * 1000;
  return expiry <= Date.now();
}

function inviteCode(): string {
  // 12 random bytes = 96 bits of entropy. Hex keeps URLs simple and avoids
  // ambiguous characters while remaining compatible with case normalization.
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const entities = base44.asServiceRole.entities;
    const squadRate = await consumeHourlyLimit(entities, user.id, 'squad_invite_create', 30);
    if (!squadRate.allowed) {
      return Response.json({ error: 'Squad action rate limit exceeded. Please try again later.' }, { status: 429 });
    }
    const [asA, asB] = await Promise.all([
      entities.Squad.filter({ member_a_id: user.id }),
      entities.Squad.filter({ member_b_id: user.id }),
    ]);
    for (const stale of [...asA, ...asB].filter((s) => s.status === 'pending' && isInviteExpired(s))) {
      await entities.Squad.update(stale.id, { status: 'ended' });
      await entities.User.updateMany(
        { id: user.id, squad_membership_id: stale.id },
        { $set: { squad_membership_id: null } },
      ).catch(() => {});
    }
    const existing = [...asA, ...asB].find((s) => s.status !== 'ended' && !isInviteExpired(s));
    if (existing) {
      return Response.json({ error: 'You already have an active or pending squad.' }, { status: 409 });
    }

    let code = '';
    for (let i = 0; i < 5; i += 1) {
      code = inviteCode();
      const duplicate = await entities.Squad.filter({ invite_code: code });
      if (duplicate.length === 0) break;
      code = '';
    }
    if (!code) throw new Error('Could not generate a unique invite code');

    const squad = await entities.Squad.create({
      member_a_id: user.id,
      member_a_name: user.display_name || user.full_name || 'Artist',
      invite_code: code,
      invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
    });

    const membershipClaim = await entities.User.updateMany(
      {
        id: user.id,
        squad_membership_id: null,
      },
      {
        $set: { squad_membership_id: squad.id },
      },
    );
    if (Number(membershipClaim?.updated || 0) !== 1) {
      await entities.Squad.delete(squad.id).catch(() => {});
      return Response.json({ error: 'You already have an active or pending squad.' }, { status: 409 });
    }

    return Response.json({ success: true, squad });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not create squad invite' }, { status: 500 });
  }
});
