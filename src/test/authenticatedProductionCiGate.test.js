// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('authenticated production E2E CI gate', () => {
  it('fails closed in Base44 CI when production smoke credentials are missing', async () => {
    const source = await readFile('scripts/base44-ci.sh', 'utf8');
    expect(source).toContain('required runner variables are missing');
    expect(source).toContain('exit 1');
    expect(source).toContain('e2e/authenticated-smoke.spec.js');
    expect(source).toContain('--project=chromium');
    expect(source).toContain('--project=mobile-chromium');
    expect(source).toContain('--project=iphone-16-simulation');
    expect(source).toContain('e2e/studio-track-drag.spec.js e2e/studio-visual-integrity.spec.js');
  });

  it('keeps the GitHub workflow credential gate documented for legacy runners', async () => {
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
