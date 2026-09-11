// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('contact mutation errors', () => {
  it('surfaces add/remove failures and prevents duplicate deletes', async () => {
    const source = await readText('src/components/messages/ContactsTab.jsx');

    expect(source).toContain('toast.error("Couldn\'t remove contact. Please try again.")');
    expect(source).toContain('toast.error("Couldn\'t add contact. Please try again.")');
    expect(source).toContain('disabled={deleteContactMutation.isPending}');
  });
});
