import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { findBlockingSquadMembership } from '../../shared/squadMembership.ts';

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
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }
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
    let existing = null;
    try {
      existing = await findBlockingSquadMembership(entities, user.id);
    } catch (cleanupError) {
      console.error('Expired squad invite cleanup failed:', cleanupError);
      return Response.json(
        { error: 'Expired squad cleanup was incomplete. Please retry.', retryable: true },
        { status: 500 },
      );
    }
    if (existing) {
      return Response.json({ error: 'You already have an active or pending squad.' }, { status: 409 });
    }

    let code = '';
    for (let i = 0; i < 5; i += 1) {
      code = inviteCode();
      const duplicate = await entities.Squad.filter(
        { invite_code: code },
        '-created_date',
        1,
      );
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
      try {
        await entities.Squad.delete(squad.id);
      } catch (cleanupError) {
        console.error('Squad invite rollback failed:', cleanupError);
        return Response.json(
          { error: 'Squad invite creation conflicted and rollback was incomplete. Please retry.', retryable: true },
          { status: 500 },
        );
      }
      return Response.json({ error: 'You already have an active or pending squad.' }, { status: 409 });
    }

    return Response.json({ success: true, userId: user.id, squad });
  } catch (error) {
    return Response.json({ error: 'Could not create squad invite' }, { status: 500 });
  }
});
