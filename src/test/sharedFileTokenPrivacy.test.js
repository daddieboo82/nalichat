// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('shared-file token lookup privacy', () => {
  it('is POST-only and does not reveal whether a file id exists', async () => {
    const source = await readText('base44/functions/getSharedFileByToken/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source.match(/Invalid or expired share link/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).not.toContain('Invalid share token');
    expect(source).not.toContain('Share link expired');
  });
});
