import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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

    const entities = base44.asServiceRole.entities;
    const [asA, asB] = await Promise.all([
      entities.Squad.filter({ member_a_id: user.id }),
      entities.Squad.filter({ member_b_id: user.id }),
    ]);
    const existing = [...asA, ...asB].find((s) => s.status !== 'ended');
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
