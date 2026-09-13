// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('maintenance scan bounds', () => {
  it('caps diagnostic snapshots, reports all truncation, and blocks partial repairs', async () => {
    const source = await readText('base44/functions/nali-maintenance/entry.ts');

    expect(source).toContain("s.User.list('-created_date', 500)");
    expect(source).not.toContain('s.User.list()');
    expect(source).toContain('const collectionCaps = {');
    expect(source).toContain('users: 500');
    expect(source).toContain('squads: 1000');
    expect(source).toContain("if (mode === 'repair')");
    expect(source).toContain('Maintenance repair requires a complete dataset. Narrow the scope and retry.');
    expect(source).toContain('partial_collections: partialCollections');
  });
});
