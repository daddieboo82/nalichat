import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { inviteCode } = await req.json();
    if (!inviteCode) return Response.json({ error: 'inviteCode is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const squads = await entities.Squad.filter({ invite_code: String(inviteCode).toUpperCase() });
    const squad = squads[0];
    if (!squad || squad.status !== 'pending' || squad.member_b_id) {
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
      return Response.json({ error: 'Invite was claimed by another user' }, { status: 409 });
    }

    const claimed = await entities.Squad.get(squad.id);
    if (claimed?.member_b_id !== user.id || claimed?.status !== 'active') {
      return Response.json({ error: 'Invite was claimed by another user' }, { status: 409 });
    }

    return Response.json({ success: true, squad: claimed });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not join squad' }, { status: 500 });
  }
});
