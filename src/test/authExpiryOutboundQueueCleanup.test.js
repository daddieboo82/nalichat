import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('auth expiry outbound queue cleanup', () => {
  it('purges the departing user queue before clearing identity on terminal 401', async () => {
    const s = await readFile('src/lib/AuthContext.jsx', 'utf8');
    const departing = s.indexOf('const departingUserId = lastUserIdRef.current;');
    const status = s.indexOf('getAuthErrorStatus(error) === 401', departing);
    const purge = s.indexOf('purgeOutboundQueueForUser(departingUserId);', status);
    const clearId = s.indexOf('lastUserIdRef.current = null;', purge);

    expect(departing).toBeGreaterThan(-1);
    expect(status).toBeGreaterThan(departing);
    expect(purge).toBeGreaterThan(status);
    expect(clearId).toBeGreaterThan(purge);
  });
});
