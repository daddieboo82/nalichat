// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('login inactivity reset', () => {
  it('clears stale activity on logout and refreshes it on fresh auth', async () => {
    const auth = await readText('src/lib/AuthContext.jsx');
    const session = await readText('src/lib/authSession.js');
    const login = await readText('src/pages/Login.jsx');
    const register = await readText('src/pages/Register.jsx');

    expect(auth).toContain("localStorage.removeItem('last_activity')");
    expect(session).toContain("localStorage.setItem('last_activity', Date.now().toString())");
    expect(login).toContain('markAuthActivity();');
    expect(register).toContain('markAuthActivity();');
  });
});
