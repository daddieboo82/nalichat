// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Messages Network query errors', () => {
  it('surfaces contacts and public-user loading failures', async () => {
    const source = await readText('src/components/messages/ContactsTab.jsx');

    expect(source).toContain('isError: contactsError');
    expect(source).toContain('isError: usersError');
    expect(source).toContain('if (res?.data?.error) throw new Error(res.data.error);');
    expect(source).toContain("Couldn't load people right now. Please try again.");
    expect(source).toContain("Couldn't load your contacts. Discovery may be incomplete.");
  });
});
