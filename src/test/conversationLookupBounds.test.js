// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('conversation lookup bounds', () => {
  it('scopes DM duplicate detection to the caller and bounds public-room lookup', async () => {
    const source = await readText('base44/functions/manageConversation/entry.ts');

    expect(source).toContain('const id = await dmConversationId(user.id, otherUserId);');
    expect(source).toContain('const existing = await base44.entities.Conversation.get(id)');
    expect(source).not.toContain("Conversation.filter({ type: 'dm' })");

    expect(source).toMatch(/is_public: true,[\s\S]*name,[\s\S]*'-created_date',[\s\S]*1/);
  });
});
