// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('project invite lookup bounds', () => {
  it('limits exact invite token lookup to one record', async () => {
    const source = await readText('base44/functions/acceptProjectInvite/entry.ts');
    expect(source).toMatch(/ProjectInvite\.filter\([\s\S]*token_hash: tokenHash[\s\S]*'-created_date',[\s\S]*1/);
  });
});
