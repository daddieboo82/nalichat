import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const MAX_LEADERBOARD_SUBMISSIONS = 500;
const MAX_WEEKLY_VOTES = 5000;
const CACHE_TTL_MS = 15_000;
const MAX_CACHE_ENTRIES = 100;
const leaderboardCache = new Map<string, { expiresAt: number; payload: unknown }>();
const leaderboardInFlight = new Map<string, Promise<unknown>>();

function pruneLeaderboardCache(now: number) {
  for (const [key, value] of leaderboardCache) {
    if (value.expiresAt <= now) leaderboardCache.delete(key);
  }
  while (leaderboardCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = leaderboardCache.keys().next().value;
    if (!oldestKey) break;
    leaderboardCache.delete(oldestKey);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const challengeId = String(body?.challengeId || '').trim();
    if (!challengeId || challengeId.length > 200) {
      return Response.json({ error: 'Valid challengeId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const nowMs = Date.now();
    pruneLeaderboardCache(nowMs);
    const cached = leaderboardCache.get(challengeId);
    if (cached && cached.expiresAt > nowMs) {
      return Response.json(cached.payload, {
        headers: { 'Cache-Control': 'public, max-age=15', 'X-Nali-Cache': 'hit' },
      });
    }

    let pending = leaderboardInFlight.get(challengeId);
    if (!pending) {
      pending = (async () => {
        const challenge = await entities.Challenge.get(challengeId);
        if (!challenge) {
          return { error: 'Challenge not found', status: 404 };
        }

        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);

        const [submissions, votes] = await Promise.all([
          entities.ChallengeSubmission.filter(
            { challenge_id: challengeId, status: 'approved' },
            '-vote_count',
            MAX_LEADERBOARD_SUBMISSIONS,
          ),
          entities.ChallengeVote.filter(
            {
              challenge_id: challengeId,
              created_date: { $gte: weekStart.toISOString() },
            },
            '-created_date',
            MAX_WEEKLY_VOTES,
          ),
        ]);

        const counts: Record<string, { all: number; week: number; today: number }> = {};
        for (const submission of submissions) {
          counts[submission.id] = {
            all: Number(submission.vote_count || 0),
            week: 0,
            today: 0,
          };
        }

        for (const vote of votes) {
          if (!counts[vote.submission_id]) continue;
          const created = vote.created_date ? new Date(vote.created_date) : null;
          if (!created || Number.isNaN(created.getTime())) continue;
          if (created >= weekStart) counts[vote.submission_id].week += 1;
          if (created >= todayStart) counts[vote.submission_id].today += 1;
        }

        const payload = {
          success: true,
          counts,
          truncated: {
            submissions: submissions.length >= MAX_LEADERBOARD_SUBMISSIONS,
            weeklyVotes: votes.length >= MAX_WEEKLY_VOTES,
          },
        };
        leaderboardCache.set(challengeId, {
          expiresAt: Date.now() + CACHE_TTL_MS,
          payload,
        });
        return payload;
      })();
      leaderboardInFlight.set(challengeId, pending);
    }

    try {
      const payload: any = await pending;
      if (payload?.error && payload?.status) {
        return Response.json({ error: payload.error }, { status: payload.status });
      }
      return Response.json(payload, {
        headers: { 'Cache-Control': 'public, max-age=15', 'X-Nali-Cache': 'miss' },
      });
    } finally {
      if (leaderboardInFlight.get(challengeId) === pending) {
        leaderboardInFlight.delete(challengeId);
      }
    }
  } catch (error) {
    console.error('getChallengeLeaderboard error:', error);
    return Response.json({ error: error?.message || 'Could not load leaderboard' }, { status: 500 });
  }
});
