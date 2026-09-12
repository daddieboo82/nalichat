// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('logout token cleanup', () => {
  it('uses the canonical token cleanup helper so legacy keys are cleared too', async () => {
    const source = await readFile('src/lib/AuthContext.jsx', 'utf8');
    expect(source).toContain("import { clearPersistedAuthTokens } from '@/lib/authSession';");
    expect(source).toContain('clearPersistedAuthTokens();');
    expect(source).toContain("localStorage.removeItem('last_activity')");
    expect(source).not.toContain("sessionStorage.removeItem('base44_token');");
  });
});
