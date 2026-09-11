import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  upcoming: ['active'],
  active: ['voting'],
  voting: ['completed'],
  completed: [],
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { challengeId, status } = await req.json();
    const nextStatus = String(status || '');
    if (!challengeId || !['upcoming', 'active', 'voting', 'completed'].includes(nextStatus)) {
      return Response.json({ error: 'Valid challengeId and status are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const challenge = await entities.Challenge.get(String(challengeId));
    if (!challenge) return Response.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.host_artist_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only the challenge host can change status' }, { status: 403 });
    }

    const current = String(challenge.status || 'upcoming');
    if (current === nextStatus) {
      return Response.json({ success: true, challenge, unchanged: true });
    }
    if (!(ALLOWED_TRANSITIONS[current] || []).includes(nextStatus)) {
      return Response.json({ error: `Invalid challenge transition: ${current} -> ${nextStatus}` }, { status: 409 });
    }

    const now = Date.now();
    if (current === 'upcoming' && nextStatus === 'active') {
      const startsAt = challenge.start_date ? new Date(challenge.start_date).getTime() : null;
      if (startsAt && Number.isFinite(startsAt) && startsAt > now && user.role !== 'admin') {
        return Response.json({ error: 'Challenge start time has not arrived yet' }, { status: 409 });
      }
    }

    const updated = await entities.Challenge.update(challenge.id, { status: nextStatus });
    return Response.json({ success: true, challenge: updated });
  } catch (error) {
    console.error('updateChallengeStatus error:', error);
    return Response.json({ error: error?.message || 'Challenge status update failed' }, { status: 500 });
  }
});
