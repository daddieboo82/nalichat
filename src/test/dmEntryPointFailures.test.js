// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('DM entry point failures', () => {
  it('surfaces rejected DM launches from conversation discovery surfaces', async () => {
    const list = await readText('src/components/messages/ConversationList.jsx');
    const bubble = await readText('src/components/messages/MessageBubble.jsx');

    expect(list).toContain('Promise.resolve(onStartDM(u)).catch((error) => {');
    expect(list).toContain('await onStartDM(user);');
    expect(list).toContain(`toast.error("Couldn't start this conversation. Please try again.")`);
    expect(list).not.toContain('Promise.resolve(onStartDM(u)).catch(() => {});');
    expect(bubble).toContain('await onStartDM(otherUser);');
    expect(bubble).toContain('if (!otherUser) return;');
  });
});
