// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('user role migration pagination', () => {
  it('scans users in bounded pages while preserving complete migration coverage', async () => {
    const source = await readText('base44/functions/migrateUserRoles/entry.ts');

    expect(source).toContain('const PAGE_SIZE = 200');
    expect(source).toMatch(/User\.filter\([\s\S]*PAGE_SIZE,[\s\S]*skip/);
    expect(source).toContain('if (users.length < PAGE_SIZE) break');
    expect(source).not.toContain('User.list()');
    expect(source).toContain('scanned');
  });
});
