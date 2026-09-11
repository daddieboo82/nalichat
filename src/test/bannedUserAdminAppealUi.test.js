// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('banned-user admin appeal UI', () => {
  it('does not depend on redacted public user roles to allow 1:1 appeal DMs', async () => {
    const messages = await readText('src/pages/Messages.jsx');
    const publicUsers = await readText('base44/functions/listPublicUsers/entry.ts');
    const sender = await readText('base44/functions/sendConversationMessage/entry.ts');

    expect(publicUsers).toContain("role: 'user'");
    expect(messages).not.toContain('convHasAdmin');
    expect(messages).toContain('(currentUser?.is_banned && selectedConv?.type !== "dm")');
    expect(sender).toContain("appealAdmin?.role !== 'admin'");
    expect(sender).toContain("conversation.type !== 'dm'");
  });
});
