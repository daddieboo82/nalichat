// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
}

describe('release configuration', () => {
  it('targets the current Android API required by the release pipeline', async () => {
    const manifest = await readJson('src/twa-manifest.json');
    expect(manifest.packageId).toBe('com.nalichat');
    expect(manifest.host).toBe('nalichat.org');
    expect(manifest.targetSdkVersion).toBeGreaterThanOrEqual(36);
  });

  it('ships a non-empty Digital Asset Links certificate fingerprint', async () => {
    const assetLinks = await readJson('public/.well-known/assetlinks.json');
    const target = assetLinks.find((entry) => entry?.target?.package_name === 'com.nalichat')?.target;
    expect(target).toBeTruthy();
    expect(target.sha256_cert_fingerprints).toEqual(
      expect.arrayContaining([expect.stringMatching(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)]),
    );
  });

  it('keeps the PWA manifest scoped to the serving origin', async () => {
    const manifest = await readJson('public/manifest.json');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    for (const shortcut of manifest.shortcuts || []) {
      expect(shortcut.url).toMatch(/^\//);
    }
  });
});
