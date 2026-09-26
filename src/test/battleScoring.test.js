import { describe, expect, it } from 'vitest';
import { tallyBattleScorecards } from '../../base44/shared/battleScoring.ts';

const scorecard = (creator, opponent) => ({
  creator_musicality: creator[0], creator_originality: creator[1], creator_technique: creator[2],
  opponent_musicality: opponent[0], opponent_originality: opponent[1], opponent_technique: opponent[2],
});

describe('battle scorecards', () => {
  it('sums each quality criterion for both artists and chooses the higher total', () => {
    const result = tallyBattleScorecards([scorecard([5, 4, 3], [2, 3, 4]), scorecard([4, 5, 4], [3, 3, 3])]);
    expect(result).toMatchObject({
      ballots: 2, creatorScore: 25, opponentScore: 18,
      totals: { creator_musicality_score: 9, creator_originality_score: 9, creator_technique_score: 7,
        opponent_musicality_score: 5, opponent_originality_score: 6, opponent_technique_score: 7 },
    });
  });
  it('excludes incomplete and out of range scorecards', () => {
    const result = tallyBattleScorecards([scorecard([5, 5, 5], [1, 1, 1]), scorecard([5, 5, 6], [1, 1, 1]), { creator_musicality: 5 }]);
    expect(result).toMatchObject({ ballots: 1, creatorScore: 15, opponentScore: 3 });
  });
  it('leaves a tie and an empty audience with equal scores', () => {
    expect(tallyBattleScorecards([scorecard([3, 4, 5], [5, 4, 3])])).toMatchObject({ ballots: 1, creatorScore: 12, opponentScore: 12 });
    expect(tallyBattleScorecards([])).toMatchObject({ ballots: 0, creatorScore: 0, opponentScore: 0 });
  });
});
