// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('challenge lifecycle serialization', () => {
  it('serializes submissions, votes, status transitions, and deletion', async () => {
    const helper = await readText('base44/shared/challengeLifecycleLock.ts');
    expect(helper).toContain('CHALLENGE_LOCK_TTL_MS = 5 * 60 * 1000');
    expect(helper).toContain('ChallengeLifecycleLock.create');
    expect(helper).toContain('ChallengeLifecycleLock.delete');

    for (const path of [
      'base44/functions/submitChallengeRemix/entry.ts',
      'base44/functions/castVote/entry.ts',
      'base44/functions/updateChallengeStatus/entry.ts',
      'base44/functions/deleteChallenge/entry.ts',
    ]) {
      const source = await readText(path);
      expect(source).toContain('acquireChallengeLifecycleLock');
      expect(source).toContain('releaseChallengeLifecycleLock');
      expect(source).toContain('status: 409');
    }
  });
});
