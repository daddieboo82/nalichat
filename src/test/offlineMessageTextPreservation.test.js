import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('offline message text preservation', () => {
  it('keeps the persisted retry payload aligned with the 20k server text limit', async () => {
    const queue = await readFile('src/lib/outboundQueue.js', 'utf8');
    const send = await readFile('base44/functions/sendConversationMessage/entry.ts', 'utf8');
    expect(queue).toContain('field === "text" ? 20_000 : 2_000');
    expect(send).toContain('Message text must be 20000 characters or fewer');
    expect(queue).not.toContain('field === "text" ? 10_000 : 2_000');
  });
});
