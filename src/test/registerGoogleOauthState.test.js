// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Google registration launch state', () => {
  it('prevents duplicate OAuth starts and surfaces safe launch errors', async () => {
    const source = await readFile('src/pages/Register.jsx', 'utf8');
    expect(source).toContain('const [googleLoading, setGoogleLoading] = useState(false);');
    expect(source).toContain('if (googleLoading) return;');
    expect(source).toContain('setGoogleLoading(true);');
    expect(source).toContain('await Promise.resolve(base44.auth.loginWithProvider("google", safeReturnTo()))');
    expect(source).toContain('googleLoginErrorMessage(err)');
    expect(source).toContain('disabled={googleLoading || loading}');
    expect(source).toContain('Connecting to Google...');
  });
});
