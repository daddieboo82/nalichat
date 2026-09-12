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
    expect(source).toContain('if (response?.data?.error) throw new Error(response.data.error);');
    expect(source).toContain('setLevelState(previousLevel);');
    expect(source).toContain('localStorage.setItem(STORAGE_KEY, previousLevel)');
    expect(source).toContain('toast.error(error?.message || "Could not save your Nali Presence setting.")');
  });
});
