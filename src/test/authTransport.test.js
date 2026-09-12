// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('authentication transport invariants', () => {
  it('uses the Base44 backend for bearer-authenticated SDK traffic', async () => {
    const params = await readText('src/lib/app-params.js');
    const client = await readText('src/api/base44Client.js');

    expect(params).toContain("VITE_BASE44_BACKEND_URL || 'https://base44.app'");
    expect(client).toContain('const { appId, token, functionsVersion, serverUrl, appBaseUrl } = appParams;');
    expect(client).toMatch(/\n\s*serverUrl,\n/);
    expect(client).not.toContain("serverUrl: ''");
  });

  it('does not retry an authoritative 401 auth failure', async () => {
    const auth = await readText('src/lib/AuthContext.jsx');

    expect(auth).toContain('if (status === 401) return false;');
    expect(auth).toContain('retryCount < 3 && shouldRetryAuthError(error)');
  });
});
