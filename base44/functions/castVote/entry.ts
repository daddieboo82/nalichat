import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

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
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be logged in to vote.' }, { status: 401 });

    const { submission_id } = await req.json();
    if (!submission_id) return Response.json({ error: 'submission_id is required' }, { status: 400 });

    const entities = base44.asServiceRole.entities;
    const submission = await entities.ChallengeSubmission.get(submission_id);
    if (!submission) return Response.json({ error: 'Submission not found' }, { status: 404 });
    if (submission.status !== 'approved') {
      return Response.json({ error: 'This submission is not eligible for voting.' }, { status: 409 });
    }

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
        voter_name: user.display_name || user.full_name || user.email,
      });
    } catch (error) {
      // Deterministic vote IDs make concurrent duplicate requests collide at
      // creation time. Verify the record exists before returning a duplicate.
      const existing = await entities.ChallengeVote.filter({
        submission_id,
        voter_id: user.id,
      });
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
      await entities.ChallengeVote.delete(id).catch(() => {});
      throw countError;
    }

    const updated = await entities.ChallengeSubmission.get(submission_id);
    return Response.json({ success: true, vote_count: updated.vote_count });
  } catch (error) {
    console.error('castVote error:', error);
    return Response.json({ error: error?.message || 'Vote failed' }, { status: 500 });
  }
}
