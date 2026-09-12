import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import {
  acquireChallengeLifecycleLock,
  releaseChallengeLifecycleLock,
} from '../../shared/challengeLifecycleLock.ts';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  upcoming: ['active'],
  active: ['voting'],
  voting: ['completed'],
  completed: [],
};

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const challengeRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'challenge_status_mutation',
      120,
    );
    if (!challengeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { challengeId, status } = await readJsonBodyLimited(req, 64 * 1024);
    const nextStatus = typeof status === 'string' ? status : '';
    if (
      typeof challengeId !== 'string'
      || !challengeId.trim()
      || challengeId.length > 200
      || !['upcoming', 'active', 'voting', 'completed'].includes(nextStatus)
    ) {
      return Response.json({ error: 'Valid challengeId and status are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const challengeLockId = await acquireChallengeLifecycleLock(entities, challengeId);
    if (!challengeLockId) {
      return Response.json(
        { error: 'Challenge is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
    const challenge = await entities.Challenge.get(challengeId);
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
    } finally {
      await releaseChallengeLifecycleLock(entities, challengeLockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('updateChallengeStatus error:', error);
    return Response.json({ error: 'Challenge status update failed' }, { status: 500 });
  }
});
