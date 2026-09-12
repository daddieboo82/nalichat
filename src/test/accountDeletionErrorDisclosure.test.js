import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('account deletion error disclosure', () => {
  it('does not return raw provider or database exception text', async () => {
    const source = await readFile('base44/functions/deleteMyAccount/entry.ts', 'utf8');

    expect(source).toContain("return Response.json({ error: 'Account deletion failed' }, { status: 500 });");
    expect(source).not.toContain("error?.message || 'Account deletion failed'");
    expect(source).toContain("console.error('deleteMyAccount failed:', error)");
  });
});
