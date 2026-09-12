// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('art post download authorization hardening', () => {
  it('requires POST and applies account-state and rate-limit checks before authorization', async () => {
    const source = await readText('base44/functions/authorizeArtPostDownload/entry.ts');

    const methodGuard = source.indexOf("if (req.method !== 'POST')");
    const bodyRead = source.indexOf('readJsonBodyLimited(req,');
    const rateLimit = source.indexOf("'art_post_download_authorization'");

    expect(methodGuard).toBeGreaterThanOrEqual(0);
    expect(source).toContain("if (user.is_banned)");
    expect(source).toContain("return Response.json({ error: 'timed_out'");
    expect(rateLimit).toBeGreaterThanOrEqual(0);
    expect(methodGuard).toBeLessThan(bodyRead);
    expect(rateLimit).toBeLessThan(bodyRead);
  });
});
