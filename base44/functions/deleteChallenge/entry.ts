import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { challengeId } = await req.json();
    if (!challengeId) {
      return Response.json({ error: 'challengeId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const challenge = await entities.Challenge.get(String(challengeId)).catch(() => null);
    if (!challenge) return Response.json({ error: 'Challenge not found' }, { status: 404 });

    if (challenge.host_artist_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [submissions, votes] = await Promise.all([
      entities.ChallengeSubmission.filter({ challenge_id: challenge.id }),
      entities.ChallengeVote.filter({ challenge_id: challenge.id }),
    ]);

    let deletedComments = 0;
    for (const submission of submissions) {
      const comments = await entities.TrackComment.filter({
        track_id: submission.id,
        parent_type: 'challenge_submission',
      });
      for (const comment of comments) {
        await entities.TrackComment.delete(comment.id);
        deletedComments += 1;
      }
    }

    for (const vote of votes) {
      await entities.ChallengeVote.delete(vote.id);
    }
    for (const submission of submissions) {
      await entities.ChallengeSubmission.delete(submission.id);
    }
    await entities.Challenge.delete(challenge.id);

    return Response.json({
      success: true,
      deleted_submissions: submissions.length,
      deleted_votes: votes.length,
      deleted_comments: deletedComments,
    });
  } catch (error) {
    console.error('deleteChallenge error:', error);
    return Response.json({ error: error?.message || 'Could not delete challenge' }, { status: 500 });
  }
});
