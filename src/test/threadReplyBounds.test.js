// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('thread reply count bounds', () => {
  it('increments thread reply counts atomically without scanning replies', async () => {
    const send = await readText('base44/functions/sendConversationMessage/entry.ts');
    expect(send).toContain('$inc: { thread_reply_count: 1 }');
    expect(send).not.toMatch(/Message\.filter\(\{\s*thread_id: messageData\.thread_id/);
  });

  it('uses a one-row child existence check and atomic decrement on reply deletion', async () => {
    const mutate = await readText('base44/functions/mutateConversationMessage/entry.ts');
    expect(mutate).toMatch(/thread_id: message\.id[\s\S]*'created_date',[\s\S]*1/);
    expect(mutate).toContain('thread_reply_count: { $gt: 0 }');
    expect(mutate).toContain('$inc: { thread_reply_count: -1 }');
  });

  it('bounds client thread history reads', async () => {
    const panel = await readText('src/components/messages/ThreadPanel.jsx');
    expect(panel).toContain('Message.filter({ thread_id: parentMessage.id }, "created_date", 500)');
  });
});
