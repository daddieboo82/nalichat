import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('App Review user blocking', () => {
  it('exposes a block-user action from received messages', async () => {
    const bubble = await read('src/components/messages/MessageBubble.jsx');
    expect(bubble).toContain('label: "Block User"');
    expect(bubble).toContain('base44.functions.invoke("blockUser"');
  });

  it('persists blocks and prevents direct messages in either direction', async () => {
    const block = await read('base44/functions/blockUser/entry.ts');
    const send = await read('base44/functions/sendConversationMessage/entry.ts');
    expect(block).toContain('entities.UserBlock.create');
    expect(send).toContain("conversation.type === 'dm'");
    expect(send).toContain("{ blocker_id: user.id, blocked_user_id: otherUserId }");
    expect(send).toContain("{ blocker_id: otherUserId, blocked_user_id: user.id }");
    expect(send).toContain("code: 'USER_BLOCKED'");
  });

  it('cleans block relationships during account deletion', async () => {
    const deletion = await read('base44/functions/deleteMyAccount/entry.ts');
    expect(deletion).toContain('{ blocker_id: user.id }');
    expect(deletion).toContain('{ blocked_user_id: user.id }');
  });
});