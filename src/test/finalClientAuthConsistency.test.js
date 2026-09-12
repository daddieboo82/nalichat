// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('final client auth consistency', () => {
  it('uses AuthContext in studio presence', async () => {
    const source = await readText('src/hooks/useStudioPresence.js');
    expect(source).toContain("import { useAuth } from '@/lib/AuthContext';");
    expect(source).toContain('const { user } = useAuth();');
    expect(source).not.toContain('base44.auth.me()');
  });

  it('uses AuthContext as Settings user source', async () => {
    const source = await readText('src/pages/Settings.jsx');
    expect(source).toContain('isLoadingAuth: loadingUser');
    expect(source).toContain('authError');
    expect(source).toContain('await checkUserAuth();');
    expect(source).not.toContain('base44.auth.me()');
    expect(source).not.toContain('setUser(');
  });

  it('refreshes Squad credits through AuthContext', async () => {
    const source = await readText('src/pages/Squad.jsx');
    expect(source).toContain('const { user, checkUserAuth } = useAuth();');
    expect(source).toContain('const fresh = await checkUserAuth();');
    expect(source).not.toContain('base44.auth.me()');
  });

  it('uses AuthContext in the not-found page', async () => {
    const source = await readText('src/lib/PageNotFound.jsx');
    expect(source).toContain("import { useAuth } from '@/lib/AuthContext';");
    expect(source).toContain('const { user, isAuthenticated, authChecked } = useAuth();');
    expect(source).not.toContain('base44.auth.me()');
    expect(source).not.toContain("useQuery");
  });
});
