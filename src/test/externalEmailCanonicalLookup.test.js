// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('external message email lookup', () => {
  it('tries a normalized registered-user lookup and sends to the canonical stored email', async () => {
    const source = await readText('base44/functions/sendExternalMessage/entry.ts');

    expect(source).toContain('const normalizedDestination = cleanDestination.toLowerCase();');
    expect(source).toContain('{ email: normalizedDestination }');
    expect(source).toContain('const registeredUser = users[0] || null;');
    expect(source).toContain('const registeredEmail = String(registeredUser.email || cleanDestination).trim();');
    expect(source).toContain('to: registeredEmail');
  });
});
