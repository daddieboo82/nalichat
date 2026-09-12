import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import {
  acquireChallengeSubmissionLock,
  releaseChallengeSubmissionLock,
} from '../../shared/challengeSubmissionLock.ts';
import {
  acquireChallengeLifecycleLock,
  releaseChallengeLifecycleLock,
} from '../../shared/challengeLifecycleLock.ts';

async function voteId(submissionId: string, userId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${submissionId}:${userId}`),
  );
  const suffix = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `challenge_vote_${suffix}`;
}

export default async function(req) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be logged in to vote.' }, { status: 401 });
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const { submission_id } = await readJsonBodyLimited(req, 8 * 1024);
    if (typeof submission_id !== 'string' || !isBase44EntityId(submission_id.trim())) {
      return Response.json({ error: 'submission_id is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const voteRate = await consumeHourlyLimit(
      entities,
      user.id,
      'challenge_vote',
      120,
    );
    if (!voteRate.allowed) {
      return Response.json({ error: 'Vote rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const submissionPreview = await entities.ChallengeSubmission.get(submission_id).catch(() => null);
    if (!submissionPreview) return Response.json({ error: 'Submission not found' }, { status: 404 });
    if (submissionPreview.status !== 'approved') {
      return Response.json({ error: 'This submission is not eligible for voting.' }, { status: 409 });
    }
    if (submissionPreview.producer_id === user.id) {
      return Response.json({ error: "You can't vote on your own submission." }, { status: 403 });
    }
    if (!isBase44EntityId(submissionPreview.challenge_id)) {
      return Response.json({ error: 'Submission has an invalid challenge reference' }, { status: 409 });
    }
    const challengePreview = await entities.Challenge.get(submissionPreview.challenge_id).catch(() => null);
    if (!challengePreview) return Response.json({ error: 'Challenge not found' }, { status: 404 });
    if (challengePreview.status !== 'voting') {
      return Response.json({ error: 'Voting is not open for this challenge.' }, { status: 409 });
    }

    const lockId = await acquireChallengeSubmissionLock(entities, submission_id);
    if (!lockId) {
      return Response.json(
        { error: 'Submission is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
    const submission = await entities.ChallengeSubmission.get(submission_id);
    if (!submission) return Response.json({ error: 'Submission not found' }, { status: 404 });
    if (submission.status !== 'approved') {
      return Response.json({ error: 'This submission is not eligible for voting.' }, { status: 409 });
    }
    if (
      !isBase44EntityId(submission.challenge_id)
      || submission.challenge_id !== submissionPreview.challenge_id
    ) {
      return Response.json({ error: 'Submission challenge changed. Please retry.' }, { status: 409 });
    }

    const challengeLockId = await acquireChallengeLifecycleLock(entities, submission.challenge_id);
    if (!challengeLockId) {
      return Response.json(
        { error: 'Challenge is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
    const challenge = await entities.Challenge.get(submission.challenge_id);
    if (!challenge) return Response.json({ error: 'Challenge not found' }, { status: 404 });
    if (challenge.status !== 'voting') {
      return Response.json({ error: 'Voting is not open for this challenge.' }, { status: 409 });
    }

    const now = Date.now();
    const submissionEnd = challenge.submission_end_date
      ? new Date(challenge.submission_end_date).getTime()
      : null;
    const votingEnd = challenge.voting_end_date
      ? new Date(challenge.voting_end_date).getTime()
      : null;
    if (submissionEnd && Number.isFinite(submissionEnd) && submissionEnd > now) {
      return Response.json({ error: 'Voting has not opened yet.' }, { status: 409 });
    }
    if (votingEnd && Number.isFinite(votingEnd) && votingEnd < now) {
      return Response.json({ error: 'Voting has ended.' }, { status: 409 });
    }

    if (submission.producer_id === user.id) {
      return Response.json({ error: "You can't vote on your own submission." }, { status: 403 });
    }

    const id = await voteId(submission_id, user.id);
    try {
      await entities.ChallengeVote.create({
        id,
        submission_id,
        challenge_id: submission.challenge_id,
        voter_id: user.id,
        voter_name: user.display_name || user.full_name || 'User',
      });
    } catch (error) {
      // Deterministic vote IDs make concurrent duplicate requests collide at
      // creation time. Verify the record exists before returning a duplicate.
      const existing = await entities.ChallengeVote.filter(
        {
          submission_id,
          voter_id: user.id,
        },
        '-created_date',
        1,
      );
      if (existing.length > 0) {
        return Response.json({ error: 'You already voted on this submission.' }, { status: 409 });
      }
      throw error;
    }

    // Increment only after the unique vote record was created successfully.
    // If the counter update fails, remove the vote ledger so the voter can
    // retry instead of being permanently recorded without a counted vote.
    try {
      await entities.ChallengeSubmission.updateMany(
        { id: submission_id },
        { $inc: { vote_count: 1 } },
      );
    } catch (countError) {
      try {
        await entities.ChallengeVote.delete(id);
      } catch (rollbackError) {
        console.error('Vote rollback failed after counter update error:', rollbackError);
        throw new Error(
          'Vote count update failed and vote rollback was incomplete. Please retry.',
          { cause: countError },
        );
      }
      throw countError;
    }

    const updated = await entities.ChallengeSubmission.get(submission_id);
    return Response.json({ success: true, vote_count: updated.vote_count });
    } finally {
      await releaseChallengeLifecycleLock(entities, challengeLockId);
    }
    } finally {
      await releaseChallengeSubmissionLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('castVote error:', error);
    return Response.json({ error: 'Vote failed' }, { status: 500 });
  }
}
