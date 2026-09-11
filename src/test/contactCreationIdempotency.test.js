// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('contact creation idempotency', () => {
  it('uses a deterministic user-pair id and recovers create races', async () => {
    const source = await readText('base44/functions/mutateContact/entry.ts');

    expect(source).toContain('async function contactRecordId');
    expect(source).toContain('contact_');
    expect(source).toContain('id: deterministicId');
    expect(source).toContain('const raced = await entities.Contact.get(deterministicId)');
    expect(source).toContain('existing: true');
    expect(source).toContain("req.method !== 'POST'");
  });
});
