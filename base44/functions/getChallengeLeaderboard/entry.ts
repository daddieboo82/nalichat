import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const challengeId = String(body?.challengeId || '');
    if (!challengeId) {
      return Response.json({ error: 'challengeId is required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const challenge = await entities.Challenge.get(challengeId);
    if (!challenge) return Response.json({ error: 'Challenge not found' }, { status: 404 });

    const [submissions, votes] = await Promise.all([
      entities.ChallengeSubmission.filter({ challenge_id: challengeId, status: 'approved' }),
      entities.ChallengeVote.filter({ challenge_id: challengeId }),
    ]);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

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

    return Response.json({ success: true, counts });
  } catch (error) {
    console.error('getChallengeLeaderboard error:', error);
    return Response.json({ error: error?.message || 'Could not load leaderboard' }, { status: 500 });
  }
});
