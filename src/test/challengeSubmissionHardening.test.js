// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('challenge submission hardening', () => {
  it('validates method/input and verifies Studio media size', async () => {
    const source = await readText('base44/functions/submitChallengeRemix/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain("action: 'submit_remix'");
    expect(source).toContain('userId: user.id');
    expect(source).toContain('challengeId: challenge.id');
    expect(source).toContain("typeof body?.challenge_id !== 'string'");
    expect(source).toContain('remixName.length > 200');
    expect(source).toContain('body.description.length > 2000');
    expect(source).toContain('Could not verify selected track size');
    expect(source).toContain('Selected track must be 100MB or smaller');
    expect(source).not.toContain("String(body?.description || '').slice(0, 2000)");
  });
});
