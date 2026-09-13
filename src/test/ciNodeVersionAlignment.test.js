import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('CI Node version alignment', () => {
  it('runs all NaliChat CI jobs on Node 22', async () => {
    const s = await readFile('.github/workflows/nalichat-ci.yml', 'utf8');
    expect(s).not.toContain("node-version: '20'");
    expect((s.match(/node-version: '22'/g) || []).length).toBe(5);
  });
});
