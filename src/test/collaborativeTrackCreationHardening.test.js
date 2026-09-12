// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('collaborative track creation hardening', () => {
  it('validates method/account state, metadata, and stored media size explicitly', async () => {
    const source = await readText('base44/functions/createCollaborativeTrack/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source.indexOf('user.is_banned')).toBeLessThan(
      source.indexOf('await consumeHourlyLimit'),
    );
    expect(source).toContain('MAX_TRACK_BYTES = 100 * 1024 * 1024');
    expect(source).toContain('Could not verify track media size');
    expect(source).toContain('Track media must be 100MB or smaller');
    expect(source).toContain("typeof body?.project_id !== 'string'");
    expect(source).toContain('name.length > 200');
    expect(source).toContain('body.waveform_data.length > 2000');
    expect(source).toContain("Invalid track type");
    expect(source).not.toContain('slice(0, 200)');
    expect(source).not.toContain('slice(0, 2000)');
  });
});
