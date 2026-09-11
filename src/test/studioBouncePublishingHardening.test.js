// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('studio bounce publishing hardening', () => {
  it('applies write guards, media bounds, and explicit metadata validation', async () => {
    const source = await readText('base44/functions/publishStudioBounce/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('user.is_banned');
    expect(source).toContain("'studio_bounce_publish'");
    expect(source).toContain('MAX_PUBLISH_BYTES = 100 * 1024 * 1024');
    expect(source).toContain('Could not verify published audio size');
    expect(source).toContain('Published audio must be 100MB or smaller');
    expect(source).toContain("typeof body.is_explicit !== 'boolean'");
    expect(source).toContain('tags.length > 30');
    expect(source).toContain('BPM must be between 1 and 400');
  });
});
