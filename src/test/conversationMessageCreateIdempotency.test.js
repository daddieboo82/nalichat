// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('conversation message create idempotency', () => {
  it('uses deterministic IDs for client-keyed messages and increments thread counters once', async () => {
    const source = await readText('base44/functions/sendConversationMessage/entry.ts');

    expect(source).toContain('async function deterministicMessageId');
    expect(source).toContain('message_');
    expect(source).toContain('id: messageId');
    expect(source).toContain('const existing = await base44.asServiceRole.entities.Message.get(messageId)');
    expect(source).toContain('createdNew = false');
    expect(source).toContain('if (createdNew && messageData.thread_id)');
    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('conversationId.length > 200');
    expect(source).toContain('text.length > 20000');
    expect(source).not.toContain('text.slice(0, 20000)');
  });
});
