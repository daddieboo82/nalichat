// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('project invite revocation bounds', () => {
  it('revokes matching project invites in bounded batches', async () => {
    const source = await readText('base44/functions/revokeProjectInvites/entry.ts');
    expect(source).toMatch(/ProjectInvite\.filter\([\s\S]*'-created_date',[\s\S]*200/);
    expect(source).toContain('revoked += 1');
    expect(source).toContain('if (invites.length < 200) break');
  });
});
