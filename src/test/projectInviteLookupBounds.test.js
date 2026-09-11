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

  it('pages child access synchronization after membership is granted', async () => {
    const source = await readText('base44/functions/acceptProjectInvite/entry.ts');
    expect(source).toContain('const ACCESS_SYNC_BATCH_SIZE = 200');
    expect(source).toContain('for (let skip = 0; ; skip += ACCESS_SYNC_BATCH_SIZE)');
    expect(source).toContain("{ project_id: project.id },\n            '-created_date',\n            ACCESS_SYNC_BATCH_SIZE,\n            skip,");
    expect(source).toContain('if (rows.length < ACCESS_SYNC_BATCH_SIZE) break;');
    expect(source.indexOf('membershipGranted = true')).toBeLessThan(source.indexOf('for (let skip = 0;'));
  });
});
