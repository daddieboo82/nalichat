// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('locked chat vault response binding', () => {
  it('binds vault responses to the exact action and authenticated user', async () => {
    const backend = await readFile('base44/functions/lockedChatVault/entry.ts', 'utf8');
    const client = await readFile('src/lib/lockedChatClient.js', 'utf8');
    const context = await readFile('src/lib/LockedChatsContext.jsx', 'utf8');

    for (const action of ['state', 'set_pin', 'verify_pin', 'set_locked', 'request_reset', 'complete_reset']) {
      expect(backend).toContain(`action: '${action}'`);
    }
    expect(backend).toContain('userId: user.id');
    expect(client).toContain('data.success === true');
    expect(client).toContain('data.action === action');
    expect(client).toContain('data.userId === expectedUserId');
    expect(context).toContain('getLockedChatState(userId)');
    expect(context).toContain('setLockedConversation(conversationId, locked, user?.id)');
  });
});
