import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('production deploy fingerprint', () => {
  it('embeds a git build SHA and exposes a production verification command', () => {
    const vite = fs.readFileSync('vite.config.js', 'utf8');
    const main = fs.readFileSync('src/main.jsx', 'utf8');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const verifier = fs.readFileSync('scripts/verify-production-deploy.mjs', 'utf8');

    expect(vite).toContain('__NALI_BUILD_SHA__');
    expect(vite).toContain("git rev-parse HEAD");
    expect(main).toContain('document.documentElement.dataset.naliBuild = __NALI_BUILD_SHA__');
    expect(pkg.scripts['verify:prod']).toBe('node scripts/verify-production-deploy.mjs');
    expect(verifier).toContain('Production drift detected');
    expect(verifier).toContain('deploy_check');
  });
});
