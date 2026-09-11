import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const viewer = await base44.auth.me().catch(() => null);
    const { inviteCode } = await req.json();
    if (!inviteCode) return Response.json({ error: 'inviteCode is required' }, { status: 400 });

    const squads = await base44.asServiceRole.entities.Squad.filter({ invite_code: String(inviteCode).toUpperCase() });
    const squad = squads[0];
    if (!squad || squad.status === 'ended') {
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
