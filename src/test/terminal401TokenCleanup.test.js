import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('terminal 401 token cleanup', () => {
  it('clears persisted auth tokens only after an authoritative 401', async () => {
    const s = await readFile('src/lib/AuthContext.jsx', 'utf8');
    const terminal = s.indexOf('if (getAuthErrorStatus(error) === 401)');
    const purge = s.indexOf('purgeOutboundQueueForUser(departingUserId)', terminal);
    const clear = s.indexOf('clearPersistedAuthTokens();', terminal);
    const retry = s.indexOf('if (retryCount < 3 && shouldRetryAuthError(error))');

    expect(retry).toBeGreaterThan(-1);
    expect(terminal).toBeGreaterThan(retry);
    expect(purge).toBeGreaterThan(terminal);
    expect(clear).toBeGreaterThan(terminal);
  });
});
