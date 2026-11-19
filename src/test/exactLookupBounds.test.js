// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('exact-match lookup bounds', () => {
  it('keeps exact lookups bounded', async () => {
    const makeAdmin = await readText('base44/functions/makeAdmin/entry.ts');
    const external = await readText('base44/functions/sendExternalMessage/entry.ts');

    expect(makeAdmin).toContain("const normalizedEmail = String(email || '').trim().toLowerCase();");
    expect(makeAdmin).toContain("User.filter({ email: normalizedEmail }, '-created_date', 2)");
    expect(makeAdmin).toContain("Multiple users match this email; manual reconciliation is required");
    expect(makeAdmin).toContain("User.get(target.id)");
    expect(external).toContain('{ email: normalizedDestination }');
    expect(external).toContain('{ email: cleanDestination }');
    expect(external.match(/'-created_date',\s*1/g)?.length).toBeGreaterThanOrEqual(2);
  });
});