import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('auth deep-link preservation', () => {
  it('keeps query strings and hashes when redirecting through login', async () => {
    const auth = await readFile('src/lib/AuthContext.jsx', 'utf8');
    const returnTo = await readFile('src/lib/authReturnTo.js', 'utf8');
    expect(auth).toContain('window.location.pathname + window.location.search + window.location.hash');
    expect(returnTo).toContain('url.pathname + url.search + url.hash');
    expect(auth).not.toContain('encodeURIComponent(window.location.pathname)');
  });
});
