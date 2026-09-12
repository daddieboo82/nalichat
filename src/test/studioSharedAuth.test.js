// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Studio shared auth state', () => {
  it('uses AuthContext identity for project permissions', async () => {
    const source = await readText('src/pages/Studio.jsx');
    expect(source).toContain("import { useAuth } from '@/lib/AuthContext';");
    expect(source).toContain('const { user } = useAuth();');
    expect(source).toContain('if (!roomId || !user?.id) return;');
    expect(source).toContain('(project.editor_ids || []).includes(user.id)');
    expect(source).not.toContain('base44.auth.me()');
  });
});
