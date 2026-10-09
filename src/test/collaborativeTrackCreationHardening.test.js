// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('collaborative track creation hardening', () => {
  it('validates method/account state and track metadata while delegating media-size checks to secure upload', async () => {
    const source = await readText('base44/functions/createCollaborativeTrack/entry.ts');
    const upload = await readText('base44/functions/secureUploadFile/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source.indexOf('user.is_banned')).toBeLessThan(
      source.indexOf('await consumeHourlyLimit'),
    );
    expect(source).toContain('cleanUploadedMediaUrl');
    expect(source).toContain("'base44.app'");
    expect(source).toContain('secureUploadFile');
    expect(source).not.toContain('resolveStoredFileSize');
    expect(upload).toContain('const MAX_BY_KIND');
    expect(upload).toContain('if (file.size > maxBytes)');
    expect(upload).toContain('status: 413');
    expect(source).toContain("typeof body?.project_id !== 'string'");
    expect(source).toContain('name.length > 200');
    expect(source).toContain('body.waveform_data.length > 2000');
    expect(source).toContain("Invalid track type");
    expect(source).not.toContain('slice(0, 200)');
    expect(source).not.toContain('slice(0, 2000)');
  });
});
