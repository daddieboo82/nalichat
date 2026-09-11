// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('challenge creation hardening', () => {
  it('requires POST and validates public challenge metadata explicitly', async () => {
    const source = await readText('base44/functions/createChallenge/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain("title must be a string");
    expect(source).toContain('title.length > 200');
    expect(source).toContain('description.length > 3000');
    expect(source).toContain('sourceTrackName.length > 255');
    expect(source).toContain('body.genre.length > 100');
    expect(source).toContain('body.rules.length > 3000');
    expect(source).not.toContain('.slice(0, 200)');
    expect(source).not.toContain('.slice(0, 3000)');
  });
});
