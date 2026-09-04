import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be logged in to vote.' }, { status: 401 });

    const { submission_id } = await req.json();
    if (!submission_id) return Response.json({ error: 'submission_id is required' }, { status: 400 });

    const submission = await base44.asServiceRole.entities.ChallengeSubmission.get(submission_id);
    if (!submission) return Response.json({ error: 'Submission not found' }, { status: 404 });

    if (submission.producer_id === user.id) {
      return Response.json({ error: "You can't vote on your own submission." }, { status: 403 });
    }

    const existing = await base44.asServiceRole.entities.ChallengeVote.filter({
      submission_id,
      voter_id: user.id,
    });
    if (existing.length > 0) {
      return Response.json({ error: 'You already voted on this submission.' }, { status: 409 });
    }

    await base44.asServiceRole.entities.ChallengeVote.create({
      submission_id,
      challenge_id: submission.challenge_id,
      voter_id: user.id,
      voter_name: user.full_name || user.email,
    });

    // Use atomic $inc to prevent race conditions on concurrent votes
    await base44.asServiceRole.entities.ChallengeSubmission.updateMany({ id: submission_id }, { $inc: { vote_count: 1 } });

    const updated = await base44.asServiceRole.entities.ChallengeSubmission.get(submission_id);

    return Response.json({ success: true, vote_count: updated.vote_count });
  } catch (error) {
    console.error('castVote error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}