// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('final composer and new-chat fixes', () => {
  it('keeps blocked send drafts and avoids duplicate contacts', async () => {
    const page = await readText('src/pages/Messages.jsx');
    const dialog = await readText('src/components/messages/NewChatDialog.jsx');

    expect(page).toContain('throw new Error(currentUser?.is_banned ? "banned" : "timed_out");');
    expect(dialog).toContain('const contactUserIds = new Set(contactUsers.map((user) => user.id));');
    expect(dialog).toContain('filtered.filter((user) => !contactUserIds.has(user.id))');
    expect(dialog).toContain('{otherUsers.map(user => (');
  });
});
