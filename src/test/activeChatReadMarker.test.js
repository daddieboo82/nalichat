import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('active chat read marker', () => {
  it('advances the local unread marker when new messages arrive in the visible chat', async () => {
    const s = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(s).toContain('const latestVisibleMessageId = messages.length > 0');
    expect(s).toContain('markConversationRead(selectedConvId);');
    expect(s).toContain('document.visibilityState !== "visible"');
    expect(s).toContain('[selectedConvId, currentUser?.id, latestVisibleMessageId]');
  });
});
