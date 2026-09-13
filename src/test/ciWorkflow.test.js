import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('repository CI', () => {
  it('runs lint, typecheck, tests, and build for main and pull requests', async () => {
    const s = await readFile('.github/workflows/ci.yml', 'utf8');
    expect(s).toContain('pull_request:');
    expect(s).toContain('branches: [main]');
    expect(s).toContain('run: npm ci');
    expect(s).toContain('run: npm run lint');
    expect(s).toContain('run: npm run typecheck');
    expect(s).toContain('run: npm test');
    expect(s).toContain('run: npm run build');
  });
});
