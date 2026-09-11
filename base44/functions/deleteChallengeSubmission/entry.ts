import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { submissionId } = await req.json();
    if (!submissionId) {
      return Response.json({ error: 'submissionId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const submission = await entities.ChallengeSubmission.get(String(submissionId));
    if (!submission) return Response.json({ error: 'Submission not found' }, { status: 404 });

    if (submission.producer_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [votes, comments] = await Promise.all([
      entities.ChallengeVote.filter({ submission_id: submission.id }),
      entities.TrackComment.filter({
        track_id: submission.id,
        parent_type: 'challenge_submission',
      }),
    ]);

    for (const vote of votes) {
      await entities.ChallengeVote.delete(vote.id);
    }
    for (const comment of comments) {
      await entities.TrackComment.delete(comment.id);
    }

    await entities.ChallengeSubmission.delete(submission.id);

    return Response.json({
      success: true,
      deleted_votes: votes.length,
      deleted_comments: comments.length,
    });
  } catch (error) {
    console.error('deleteChallengeSubmission error:', error);
    return Response.json({ error: error?.message || 'Could not delete submission' }, { status: 500 });
  }
});
