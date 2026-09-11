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

    const { inviteCode } = await req.json();
    if (!inviteCode) return Response.json({ error: 'inviteCode is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const squadRate = await consumeHourlyLimit(entities, user.id, 'squad_join', 60);
    if (!squadRate.allowed) {
      return Response.json({ error: 'Squad action rate limit exceeded. Please try again later.' }, { status: 429 });
    }
    const squads = await entities.Squad.filter({ invite_code: String(inviteCode).toUpperCase() });
    const squad = squads[0];
    if (!squad || squad.status !== 'pending' || squad.member_b_id || isInviteExpired(squad)) {
      if (squad?.status === 'pending' && isInviteExpired(squad)) {
        await entities.Squad.update(squad.id, { status: 'ended' }).catch(() => {});
        await entities.User.updateMany(
          { id: squad.member_a_id, squad_membership_id: squad.id },
          { $set: { squad_membership_id: null } },
        ).catch(() => {});
      }
      return Response.json({ error: 'Invite already used or unavailable' }, { status: 409 });
    }
    if (squad.member_a_id === user.id) {
      return Response.json({ error: 'You cannot join your own squad invite' }, { status: 400 });
    }

    const [asA, asB] = await Promise.all([
      entities.Squad.filter({ member_a_id: user.id }),
      entities.Squad.filter({ member_b_id: user.id }),
    ]);
    if ([...asA, ...asB].some((candidate) => candidate.status !== 'ended')) {
      return Response.json({ error: 'You already have an active or pending squad.' }, { status: 409 });
    }

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
      return Response.json({ error: 'You already have an active or pending squad.' }, { status: 409 });
    }

    // Atomically claim the pending slot so only one concurrent join can win.
    const claim = await entities.Squad.updateMany(
      {
        id: squad.id,
        status: 'pending',
        member_b_id: null,
      },
      {
        $set: {
          member_b_id: user.id,
          member_b_name: user.display_name || user.full_name || 'Artist',
          status: 'active',
        },
      },
    );
    if (Number(claim?.updated || 0) !== 1) {
      await entities.User.updateMany(
        { id: user.id, squad_membership_id: squad.id },
        { $set: { squad_membership_id: null } },
      ).catch(() => {});
      return Response.json({ error: 'Invite was claimed by another user' }, { status: 409 });
    }

    const claimed = await entities.Squad.get(squad.id);
    if (claimed?.member_b_id !== user.id || claimed?.status !== 'active') {
      await entities.User.updateMany(
        { id: user.id, squad_membership_id: squad.id },
        { $set: { squad_membership_id: null } },
      ).catch(() => {});
      return Response.json({ error: 'Invite was claimed by another user' }, { status: 409 });
    }

    return Response.json({ success: true, squad: claimed });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not join squad' }, { status: 500 });
  }
});
