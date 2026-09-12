// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('auth identity request freshness', () => {
  it('does not share an in-flight /me promise across session transitions', async () => {
    const source = await readFile('src/api/base44Client.js', 'utf8');
    expect(source).not.toContain('auth.me() request de-duplication');
    expect(source).not.toContain('let inFlight = null');
    expect(source).not.toContain('base44.auth.me =');
  });

  it('keeps frontend identity resolution centralized in AuthContext', async () => {
    const auth = await readFile('src/lib/AuthContext.jsx', 'utf8');
    expect(auth).toContain('const currentUser = await base44.auth.me();');
  });
});
