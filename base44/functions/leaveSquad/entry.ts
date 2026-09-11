import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { squadId } = await req.json();
    const squad = await base44.asServiceRole.entities.Squad.get(squadId);
    if (!squad || (squad.member_a_id !== user.id && squad.member_b_id !== user.id)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const entities = base44.asServiceRole.entities;
    await entities.Squad.update(squad.id, { status: 'ended' });
    for (const memberId of [squad.member_a_id, squad.member_b_id].filter(Boolean)) {
      await entities.User.updateMany(
        { id: memberId, squad_membership_id: squad.id },
        { $set: { squad_membership_id: null } },
      ).catch(() => {});
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not leave squad' }, { status: 500 });
  }
});
