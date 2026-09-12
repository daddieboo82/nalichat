import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import {
  acquireChallengeSubmissionLock,
  releaseChallengeSubmissionLock,
} from '../../shared/challengeSubmissionLock.ts';

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

    const deleteRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'challenge_submission_delete',
      60,
    );
    if (!deleteRate.allowed) {
      return Response.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { submissionId } = await readJsonBodyLimited(req, 64 * 1024);
    if (typeof submissionId !== 'string' || !submissionId.trim() || submissionId.length > 200) {
      return Response.json({ error: 'submissionId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const submissionPreview = await entities.ChallengeSubmission.get(submissionId).catch(() => null);
    if (!submissionPreview) return Response.json({ error: 'Submission not found' }, { status: 404 });
    if (submissionPreview.producer_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const lockId = await acquireChallengeSubmissionLock(entities, submissionId);
    if (!lockId) {
      return Response.json(
        { error: 'Submission is being updated. Please retry.' },
        { status: 409 },
      );
    }

    try {
    const submission = await entities.ChallengeSubmission.get(submissionId);
    if (!submission) return Response.json({ error: 'Submission not found' }, { status: 404 });

    if (submission.producer_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    let deletedVotes = 0;
    while (true) {
      const votes = await entities.ChallengeVote.filter(
        { submission_id: submission.id },
        '-created_date',
        200,
      );
      if (votes.length === 0) break;

      for (const vote of votes) {
        await entities.ChallengeVote.delete(vote.id);
        deletedVotes += 1;
      }

      if (votes.length < 200) break;
    }

    let deletedComments = 0;
    while (true) {
      const comments = await entities.TrackComment.filter(
        {
          track_id: submission.id,
          parent_type: 'challenge_submission',
        },
        '-created_date',
        200,
      );
      if (comments.length === 0) break;

      for (const comment of comments) {
        await entities.TrackComment.delete(comment.id);
        deletedComments += 1;
      }

      if (comments.length < 200) break;
    }

    await entities.ChallengeSubmission.delete(submission.id);

    return Response.json({
      success: true,
      deleted_votes: deletedVotes,
      deleted_comments: deletedComments,
    });
    } finally {
      await releaseChallengeSubmissionLock(entities, lockId);
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('deleteChallengeSubmission error:', error);
    return Response.json({ error: 'Could not delete submission' }, { status: 500 });
  }
});
