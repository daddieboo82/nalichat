// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Nali presence persistence', () => {
  it('rolls back signed-in preference changes when persistence fails', async () => {
    const source = await readText('src/lib/NaliPresenceContext.jsx');
    expect(source).toContain('const previousLevel = level;');
    expect(source).toContain('if (!VALID_LEVELS.includes(newLevel) || savingRef.current) return;');
    expect(source).toContain('savingRef.current = true;');
    expect(source).toContain('savingRef.current = false;');
    expect(source).toContain('if (response?.data?.error) throw new Error(response.data.error);');
    expect(source).toContain('setLevelState(previousLevel);');
    expect(source).toContain('localStorage.setItem(storageKey, previousLevel)');
    expect(source).toContain('toast.error(error?.message || "Could not save your Nali Presence setting.")');
  });

  it('isolates local Nali presence preferences by account', async () => {
    const source = await readText('src/lib/NaliPresenceContext.jsx');
    expect(source).toContain('const storageKey = storageKeyFor(user?.id);');
    expect(source).toContain('nali_presence_level:${userId || "anonymous"}');
    expect(source).toContain('localStorage.getItem(storageKey)');
    expect(source).toContain('localStorage.setItem(storageKey, newLevel)');
    expect(source).toContain('if (!user?.id)');
    expect(source).not.toContain('localStorage.setItem(STORAGE_KEY');
  });
});
