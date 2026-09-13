import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('moderated user presence cleanup', () => {
  it('allows offline cleanup but blocks moderated users from advertising online', async () => {
    const s = await readFile('base44/functions/updateUserPresence/entry.ts', 'utf8');
    const parse = s.indexOf("const { isOnline } = await readJsonBodyLimited(req, 8 * 1024)");
    const bannedGate = s.indexOf('if (isOnline && user.is_banned)', parse);
    const timeoutGate = s.indexOf('isOnline\n      && user.timeout_until', bannedGate);
    const update = s.indexOf('is_online: isOnline', timeoutGate);

    expect(parse).toBeGreaterThan(-1);
    expect(bannedGate).toBeGreaterThan(parse);
    expect(timeoutGate).toBeGreaterThan(bannedGate);
    expect(update).toBeGreaterThan(timeoutGate);
  });
});
