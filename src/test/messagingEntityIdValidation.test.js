import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('messaging entity id validation', () => {
  it('validates conversation ids before typing-status reads', async () => {
    const source = await readFile('base44/functions/updateTypingStatus/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(conversationId)');
    expect(source.indexOf('isBase44EntityId(conversationId)')).toBeLessThan(source.indexOf('entities.Conversation.get(conversationId)'));
  });

  it('validates message ids before read-receipt reads', async () => {
    const source = await readFile('base44/functions/markMessageRead/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(messageId)');
    expect(source.indexOf('isBase44EntityId(messageId)')).toBeLessThan(source.indexOf('entities.Message.get(messageId)'));
  });
});
