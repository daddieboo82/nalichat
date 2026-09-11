// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('maintenance scan bounds', () => {
  it('caps the user snapshot and reports possible truncation', async () => {
    const source = await readText('base44/functions/nali-maintenance/entry.ts');

    expect(source).toContain("s.User.list('-created_date', 500)");
    expect(source).not.toContain('s.User.list()');
    expect(source).toContain('users: Array.isArray(data.users) && data.users.length >= 500');
  });
});
