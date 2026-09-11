// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('health-check user scan bounds', () => {
  it('uses a bounded user snapshot and a targeted admin query', async () => {
    const source = await readText('base44/functions/naliHealthCheck/entry.ts');

    expect(source).toContain("User.list('-created_date', 200)");
    expect(source).toContain("User.filter({ role: 'admin' }, '-created_date', 100)");
    expect(source).not.toContain('User.list()');
    expect(source).not.toContain("users.filter(u => u.role === 'admin')");
  });
});
