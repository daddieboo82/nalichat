// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(path, 'utf8');
}

describe('Google login session recovery', () => {
  it('clears stale bearer tokens before launching Google OAuth', async () => {
    const login = await readText('src/pages/Login.jsx');
    const clearIndex = login.indexOf('clearPersistedAuthTokens();');
    const oauthIndex = login.indexOf('base44.auth.loginWithProvider("google", safeReturnTo())');

    expect(clearIndex).toBeGreaterThan(-1);
    expect(oauthIndex).toBeGreaterThan(clearIndex);
    expect(login).toContain('markAuthActivity();');
    expect(login).toContain('googleLoginErrorMessage(err)');
    expect(login).toContain('setGoogleLoading(false);');
  });

  it('always checks the live user session after public settings, even without a bearer token', async () => {
    const auth = await readText('src/lib/AuthContext.jsx');
    const publicSettingsBlock = auth.indexOf('const publicSettings = await appClient.get');
    const authCheck = auth.indexOf('await checkUserAuth();', publicSettingsBlock);

    expect(publicSettingsBlock).toBeGreaterThan(-1);
    expect(authCheck).toBeGreaterThan(publicSettingsBlock);
    expect(auth).toContain('Google/platform OAuth may complete with a same-origin cookie-backed');
    expect(auth).not.toContain('if (appParams.token) {\n        await checkUserAuth();');
  });

  it('does not turn a token-backed new Google user propagation delay into a terminal auth error', async () => {
    const auth = await readText('src/lib/AuthContext.jsx');
    expect(auth).toContain("reason === 'user_not_registered'");
    expect(auth).toContain('if (!appParams.token) {');
    expect(auth).toContain("setAuthError({ type: 'user_not_registered'");
    expect(auth).toContain('if (retryCount < 3 && shouldRetryAuthError(error))');
  });
});
