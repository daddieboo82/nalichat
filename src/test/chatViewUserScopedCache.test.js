import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('ChatView user-scoped message cache', () => {
  it('uses the same user-scoped cache key as Messages.jsx', async () => {
    const source = await readFile('src/components/messages/ChatView.jsx', 'utf8');
    expect(source).toContain('["messages", currentUser?.id, conversation?.id]');
    expect(source).not.toContain('["messages", conversation?.id]');
  });
});
