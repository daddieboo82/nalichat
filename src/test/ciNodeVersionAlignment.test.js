import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('CI Node version alignment', () => {
  it('runs every NaliChat quality-gate job on Node 22', async () => {
    const s = await readFile('.github/workflows/quality-gates.yml', 'utf8');
    expect(s).not.toMatch(/node-version:\s*['"]?20['"]?/);
    const setupNodeCount = (s.match(/actions\/setup-node@v4/g) || []).length;
    const node22Count = (s.match(/node-version:\s*['"]?22['"]?/g) || []).length;
    expect(setupNodeCount).toBeGreaterThan(0);
    expect(node22Count).toBe(setupNodeCount);
  });
});
