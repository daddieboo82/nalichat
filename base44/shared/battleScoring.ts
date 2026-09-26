const fields = [
  'creator_musicality_score', 'creator_originality_score', 'creator_technique_score',
  'opponent_musicality_score', 'opponent_originality_score', 'opponent_technique_score',
];

export function tallyBattleScorecards(votes: Array<Record<string, unknown>>) {
  const totals: Record<string, number> = Object.fromEntries(fields.map(field => [field, 0]));
  let ballots = 0;
  for (const vote of votes) {
    const values = fields.map(field => Number(vote[field.replace('_score', '')]));
    if (!values.every(value => Number.isInteger(value) && value >= 1 && value <= 5)) continue;
    fields.forEach((field, index) => { totals[field] += values[index]; });
    ballots++;
  }
  const creatorScore = totals.creator_musicality_score + totals.creator_originality_score + totals.creator_technique_score;
  const opponentScore = totals.opponent_musicality_score + totals.opponent_originality_score + totals.opponent_technique_score;
  return { totals, ballots, creatorScore, opponentScore };
}
