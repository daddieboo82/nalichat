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

    await base44.asServiceRole.entities.Squad.update(squad.id, { status: 'ended' });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not leave squad' }, { status: 500 });
  }
});
