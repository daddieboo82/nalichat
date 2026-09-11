// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('conversation cleanup bounds', () => {
  it('pages audience synchronization and batches final conversation deletion', async () => {
    const source = await readFile(
      new URL('../../base44/functions/manageConversation/entry.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain('const PAGE_SIZE = 200;');
    expect(source).toMatch(/Message\.filter\([\s\S]*conversation_id: conversationId[\s\S]*PAGE_SIZE,[\s\S]*skip/);
    expect(source).toMatch(/TypingStatus\.filter\([\s\S]*conversation_id: conversationId[\s\S]*PAGE_SIZE,[\s\S]*skip/);
    expect(source).toContain('deleteConversationRows(entities.Message, conversation.id)');
    expect(source).toContain('deleteConversationRows(entities.TypingStatus, conversation.id)');
    expect(source).toContain('deleted_messages: deletedMessages');
    expect(source).toContain('deleted_typing_rows: deletedTypingRows');
  });
});
