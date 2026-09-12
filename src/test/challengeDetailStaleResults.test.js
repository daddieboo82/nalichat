// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Challenge Detail stale-result protection', () => {
  it('only applies challenge/submission/vote results for the current route', async () => {
    const source = await readText('src/pages/ChallengeDetail.jsx');
    expect(source).toContain('const challengeIdRef = useRef(challengeId);');
    expect(source).toContain('challengeIdRef.current = challengeId;');
    expect(source).toContain('if (challengeIdRef.current === requestedChallengeId)');
    expect(source).toContain('if (challengeIdRef.current !== requestedChallengeId) return;');
    expect(source).toContain('let cancelled = false;');
    expect(source).toContain('if (!cancelled)');
  });
});
