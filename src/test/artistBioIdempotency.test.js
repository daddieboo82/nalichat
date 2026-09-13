import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('artist bio AI idempotency', () => {
  it('uses an explicit request key or a short server-side retry bucket', async () => {
    const s = await readFile('base44/functions/generateArtistBio/entry.ts', 'utf8');
    expect(s).toContain("const explicitRequestKey = typeof body?.request_key === 'string'");
    expect(s).toContain("const requestKey = explicitRequestKey || `artist-bio:${user.id}:${fallbackBucket}`");
    expect(s).toContain('requestKey,');
    expect(s).not.toContain('requestKey: undefined');
    expect(s).toContain('readJsonBodyLimited(req, 8 * 1024)');
  });
});
