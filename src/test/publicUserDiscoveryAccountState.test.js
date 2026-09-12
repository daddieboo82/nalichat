// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('public user discovery account state', () => {
  it('blocks restricted accounts and does not expose internal errors', async () => {
    const source = await readText('base44/functions/listPublicUsers/entry.ts');

    expect(source).toContain('if (user.is_banned)');
    expect(source).toContain("return Response.json({ error: 'timed_out'");
    expect(source).toContain("return Response.json({ error: 'Could not list public users' }, { status: 500 });");
    expect(source).not.toContain("Response.json({ error: error?.message");
  });
});
