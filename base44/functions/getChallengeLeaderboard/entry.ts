import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const challengeId = String(body?.challenge_id || '').trim();
    if (!challengeId) {
      return Response.json({ error: 'challenge_id is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const challenge = await entities.Challenge.get(challengeId);
    if (!challenge) {
      return Response.json({ error: 'Challenge not found' }, { status: 404 });
    }

    const [submissions, votes] = await Promise.all([
      entities.ChallengeSubmission.filter({
        challenge_id: challengeId,
        status: 'approved',
      }),
      entities.ChallengeVote.filter({ challenge_id: challengeId }),
    ]);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const counts = new Map();
    for (const submission of submissions) {
      counts.set(submission.id, {
        all_time: Number(submission.vote_count || 0),
        week: 0,
        today: 0,
      });
    }

    for (const vote of votes) {
      const bucket = counts.get(vote.submission_id);
      if (!bucket) continue;
      const created = vote.created_date ? new Date(vote.created_date) : null;
      if (!created || Number.isNaN(created.getTime())) continue;
      if (created >= weekStart) bucket.week += 1;
      if (created >= todayStart) bucket.today += 1;
    }

    const rows = submissions.map((submission) => {
      const bucket = counts.get(submission.id) || { all_time: 0, week: 0, today: 0 };
      return {
        id: submission.id,
        challenge_id: submission.challenge_id,
        producer_id: submission.producer_id,
        producer_name: submission.producer_name,
        producer_avatar: submission.producer_avatar,
        remix_name: submission.remix_name,
        counts: bucket,
      };
    });

    return Response.json({
      challenge: { id: challenge.id, title: challenge.title },
      rows,
    });
  } catch (error) {
    console.error('getChallengeLeaderboard error:', error);
    return Response.json({ error: error?.message || 'Could not load leaderboard' }, { status: 500 });
  }
}
