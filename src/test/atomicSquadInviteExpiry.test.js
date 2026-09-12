import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('atomic squad invite expiry enforcement', () => {
  it('includes invite expiry in the atomic squad claim', async () => {
    const s=await readFile('base44/functions/joinSquad/entry.ts','utf8');
    const filter=s.indexOf('const claimFilter: Record<string, unknown>');
    const expiry=s.indexOf("claimFilter.invite_expires_at = { $gt: new Date().toISOString() }", filter);
    const update=s.indexOf('entities.Squad.updateMany(', expiry);
    expect(filter).toBeGreaterThan(-1);
    expect(expiry).toBeGreaterThan(filter);
    expect(update).toBeGreaterThan(expiry);
  });
  it('binds the atomic claim to the normalized invite code', async () => {
    const s=await readFile('base44/functions/joinSquad/entry.ts','utf8');
    expect(s).toContain('invite_code: normalizedInviteCode');
  });
});
