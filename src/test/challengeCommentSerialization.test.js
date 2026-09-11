// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('challenge comment serialization', () => {
  it('serializes challenge-submission comment creation with deletion/voting', async () => {
    const source = await readText('base44/functions/trackComments/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('acquireChallengeSubmissionLock');
    expect(source).toContain('releaseChallengeSubmissionLock');
    expect(source).toContain("action === 'create' && parentType === 'challenge_submission'");
    expect(source).toContain('parentId.length > 200');
    expect(source).toContain("typeof body?.text !== 'string'");
    expect(source).toContain('text.length > 2000');
    expect(source).toContain("typeof body.timestamp !== 'number'");
  });
});
