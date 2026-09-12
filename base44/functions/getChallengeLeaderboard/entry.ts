import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const MAX_LEADERBOARD_SUBMISSIONS = 500;
const MAX_WEEKLY_VOTES = 5000;
const CACHE_TTL_MS = 15_000;
const MAX_CACHE_ENTRIES = 100;
const leaderboardCache = new Map<string, { expiresAt: number; payload: unknown; status?: number }>();
const leaderboardInFlight = new Map<string, Promise<unknown>>();

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function leaderboardClientScope(req: Request): Promise<string> {
  const forwarded = String(
    req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || req.headers.get('x-forwarded-for')
    || '',
  ).split(',')[0].trim().slice(0, 128);
  const userAgent = String(req.headers.get('user-agent') || '').slice(0, 256);
  return 'leaderboard_read_' + await sha256Hex(`${forwarded || 'unknown'}:${userAgent || 'unknown'}`);
}

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
    const body = await readJsonBodyLimited(req, 8 * 1024);
    const challengeId = String(body?.challengeId || '').trim();
    if (!/^[0-9A-F]{24}$/i.test(challengeId)) {
      return Response.json({ error: 'Valid challengeId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const nowMs = Date.now();
    pruneLeaderboardCache(nowMs);
    const cached = leaderboardCache.get(challengeId);
    if (cached && cached.expiresAt > nowMs) {
      return Response.json(cached.payload, {
        status: cached.status || 200,
        headers: { 'Cache-Control': 'public, max-age=15', 'X-Nali-Cache': 'hit' },
      });
    }

    let pending = leaderboardInFlight.get(challengeId);
    if (!pending) {
      const readScope = await leaderboardClientScope(req);
      const readRate = await consumeHourlyLimit(
        entities,
        readScope,
        'challenge_leaderboard_read',
        240,
      );
      if (!readRate.allowed) {
        return Response.json(
          { error: 'Too many leaderboard requests. Please try again later.' },
          { status: 429 },
        );
      }

      pending = (async () => {
        const challenge = await entities.Challenge.get(challengeId);
        if (!challenge) {
          const payload = { error: 'Challenge not found' };
          leaderboardCache.set(challengeId, {
            expiresAt: Date.now() + CACHE_TTL_MS,
            payload,
            status: 404,
          });
          return { ...payload, status: 404 };
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
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('getChallengeLeaderboard error:', error);
    return Response.json({ error: 'Could not load leaderboard' }, { status: 500 });
  }
});
