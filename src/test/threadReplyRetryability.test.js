// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('thread reply count retryability', () => {
  it('rolls back a newly-created reply if the parent counter update fails', async () => {
    const source = await readText('base44/functions/sendConversationMessage/entry.ts');

    expect(source).toContain("Unable to update thread reply count");
    expect(source).toContain('Number(replyCountUpdate?.updated || 0) !== 1');
    expect(source).toContain('Message.delete(message.id)');
    expect(source).toContain('throw countError');
    expect(source.indexOf('Message.delete(message.id)')).toBeGreaterThan(
      source.indexOf('$inc: { thread_reply_count: 1 }'),
    );
  });
});
