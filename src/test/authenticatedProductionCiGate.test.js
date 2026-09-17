// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('authenticated production E2E CI gate', () => {
  it('fails closed when production smoke credentials are missing', async () => {
    const source = await readFile('.github/workflows/quality-gates.yml', 'utf8');
    expect(source).toContain('production-authenticated-e2e:');
    expect(source).toContain('E2E_BASE_URL: https://nalichat.org');
    expect(source).toContain('secrets.E2E_USER_EMAIL');
    expect(source).toContain('secrets.E2E_USER_PASSWORD');
    expect(source).toContain('secrets.E2E_SECOND_USER_EMAIL');
    expect(source).toContain('secrets.E2E_SECOND_USER_PASSWORD');
    expect(source).toContain('Require production E2E credentials');
    expect(source).toContain('npm run test:e2e -- e2e/authenticated-smoke.spec.js');
  });
});
