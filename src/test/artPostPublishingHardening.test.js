// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('art post publishing hardening', () => {
  it('aligns normal publishing with Studio media and input protections', async () => {
    const source = await readText('base44/functions/createArtPost/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source.indexOf('user.is_banned')).toBeLessThan(
      source.indexOf('consumeHourlyLimit'),
    );
    expect(source).toContain('MAX_PUBLISH_BYTES = 100 * 1024 * 1024');
    expect(source).toContain('Could not verify uploaded media size');
    expect(source).toContain('Published audio must be 100MB or smaller');
    expect(source).toContain("typeof body.is_explicit !== 'boolean'");
    expect(source).toContain('rawTags.length > 30');
    expect(source).toContain("Unsupported media type");
    expect(source).not.toContain('.slice(0, 2000)');
    expect(source).not.toContain('.slice(0, 100)');
  });
});
