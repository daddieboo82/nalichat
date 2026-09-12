// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('GlobalMessageDialog auth state', () => {
  it('uses AuthContext and avoids duplicate auth.me calls', async () => {
    const source = await readText('src/components/GlobalMessageDialog.jsx');
    expect(source).toContain('import { useAuth } from "@/lib/AuthContext";');
    expect(source).toContain('const { user: currentUser, isAuthenticated, isLoadingAuth } = useAuth();');
    expect(source).toContain('enabled: open && isAuthenticated');
    expect(source).not.toContain('base44.auth.me()');
    expect(source).not.toContain('setCurrentUser');
  });
});
