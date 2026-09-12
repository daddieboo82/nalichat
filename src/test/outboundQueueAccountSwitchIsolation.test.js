import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('outbound queue account-switch isolation', () => {
  it('purges only the departing user on direct identity replacement and logout', async () => {
    const auth = await readFile('src/lib/AuthContext.jsx', 'utf8');
    const queue = await readFile('src/lib/outboundQueue.js', 'utf8');

    expect(queue).toContain('export function purgeOutboundQueueForUser');
    expect(queue).toContain('entry.sender?.id !== userId');
    expect(queue).toContain('Unable to purge the outbound message queue');
    expect(auth).toContain('purgeOutboundQueueForUser(previousUserId);');
    expect(auth).toContain('const departingUserId = lastUserIdRef.current;');
    expect(auth).toContain('purgeOutboundQueueForUser(departingUserId);');
    expect(auth.indexOf('purgeOutboundQueueForUser(departingUserId);')).toBeLessThan(
      auth.indexOf('clearPersistedAuthTokens();'),
    );
  });
});
