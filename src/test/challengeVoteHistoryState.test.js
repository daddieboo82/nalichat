import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge vote history reliability', () => {
  it('pauses voting when existing vote history cannot be verified', async () => {
    const page = await readFile('src/pages/ChallengeDetail.jsx', 'utf8');
    const card = await readFile('src/components/challenges/SubmissionCard.jsx', 'utf8');
    expect(page).toContain('const [votesError, setVotesError] = useState(false);');
    expect(page).toContain("Couldn't verify which submissions you've already voted for.");
    expect(page).toContain('voteDisabled={Boolean(user) && (votesLoading || votesError)}');
    expect(card).toContain('voteDisabled = false');
    expect(card).toContain('disabled={hasVoted || isOwn || voteDisabled}');
  });
});
