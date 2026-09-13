// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('track version creation hardening', () => {
  it('validates method/input and re-verifies stored version media size', async () => {
    const source = await readText('base44/functions/createTrackVersion/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain("typeof body?.track_id !== 'string'");
    expect(source).toContain("typeof body?.project_id !== 'string'");
    expect(source).toContain('isBase44EntityId(body.track_id.trim())');
    expect(source).toContain('isBase44EntityId(body.project_id.trim())');
    expect(source).toContain('body.label.length > 200');
    expect(source).toContain('MAX_TRACK_VERSION_BYTES = 100 * 1024 * 1024');
    expect(source).toContain('Could not verify track version media size');
    expect(source).toContain('Track version media must be 100MB or smaller');
    expect(source).not.toContain('.slice(0, 200)');
  });
});
