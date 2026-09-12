import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import {
  acquireChallengeLifecycleLock,
  releaseChallengeLifecycleLock,
} from '../../shared/challengeLifecycleLock.ts';

const DELETE_BATCH_SIZE = 200;

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
      'challenge_delete',
      30,
    );
    if (!challengeRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { challengeId } = await readJsonBodyLimited(req, 64 * 1024);
    if (typeof challengeId !== 'string' || !challengeId.trim() || challengeId.length > 200) {
      return Response.json({ error: 'challengeId is required' }, { status: 400 });
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
    const challenge = await entities.Challenge.get(challengeId).catch(() => null);
    if (!challenge) return Response.json({ error: 'Challenge not found' }, { status: 404 });

    if (challenge.host_artist_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let deletedVotes = 0;
    while (true) {
      const votes = await entities.ChallengeVote.filter(
        { challenge_id: challenge.id },
        '-created_date',
        DELETE_BATCH_SIZE,
      );
      if (votes.length === 0) break;
      for (const vote of votes) {
        await entities.ChallengeVote.delete(vote.id);
        deletedVotes += 1;
      }
      if (votes.length < DELETE_BATCH_SIZE) break;
    }

    let deletedSubmissions = 0;
    let deletedComments = 0;
    while (true) {
      const submissions = await entities.ChallengeSubmission.filter(
        { challenge_id: challenge.id },
        '-created_date',
        DELETE_BATCH_SIZE,
      );
      if (submissions.length === 0) break;
      for (const submission of submissions) {
        while (true) {
          const comments = await entities.TrackComment.filter(
            {
              track_id: submission.id,
              parent_type: 'challenge_submission',
            },
            '-created_date',
            DELETE_BATCH_SIZE,
          );
          if (comments.length === 0) break;
          for (const comment of comments) {
            await entities.TrackComment.delete(comment.id);
            deletedComments += 1;
          }
          if (comments.length < DELETE_BATCH_SIZE) break;
        }
        await entities.ChallengeSubmission.delete(submission.id);
        deletedSubmissions += 1;
      }
      if (submissions.length < DELETE_BATCH_SIZE) break;
    }
    await entities.Challenge.delete(challenge.id);

    return Response.json({
      success: true,
      deleted_submissions: deletedSubmissions,
      deleted_votes: deletedVotes,
      deleted_comments: deletedComments,
    });
    } finally {
      await releaseChallengeLifecycleLock(entities, challengeLockId);
    }
  } catch (error) {
    console.error('deleteChallenge error:', error);
    return Response.json({ error: error?.message || 'Could not delete challenge' }, { status: 500 });
  }
});
