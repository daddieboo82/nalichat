// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Messages contacts presence', () => {
  it('requests presence and renders an active-now indicator on contact cards', async () => {
    const source = await readText('src/components/messages/ContactsTab.jsx');

    expect(source).toContain("listPublicUsers', { includePresence: true }");
    expect(source).toContain('user.is_online');
    expect(source).toContain('aria-label="Active now"');
  });
});
