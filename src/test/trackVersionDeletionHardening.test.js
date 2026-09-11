// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('track version deletion hardening', () => {
  it('rejects non-POST and malformed version ids before privileged reads', async () => {
    const source = await readText('base44/functions/deleteTrackVersion/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain("typeof versionId !== 'string'");
    expect(source).toContain('versionId.length > 200');
    expect(source.indexOf("req.method !== 'POST'")).toBeLessThan(
      source.indexOf('createClientFromRequest(req)'),
    );
    expect(source.indexOf('versionId.length > 200')).toBeLessThan(
      source.indexOf('entities.TrackVersion.get(versionId)'),
    );
  });
});
