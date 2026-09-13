import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge hub pagination', () => {
  it('loads all challenge lifecycle rows in bounded pages', async () => {
    const s = await readFile('src/pages/ChallengeHub.jsx', 'utf8');
    expect(s).toContain('async function listAllChallenges()');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('const list = await listAllChallenges();');
    expect(s).not.toContain('Challenge.list("-created_date")');
  });
});
