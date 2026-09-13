// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('mobile Messages viewport scrolling', () => {
  it('uses the dynamic viewport and a bounded chat pane', async () => {
    const layout = await readFile('src/components/layout/AppLayout.jsx', 'utf8');
    const messages = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(layout).toContain('h-screen h-[100dvh]');
    expect(messages).toContain('flex-1 h-full min-h-0 flex flex-col');
  });

  it('enables native vertical touch scrolling in the message history', async () => {
    const chat = await readFile('src/components/messages/ChatView.jsx', 'utf8');
    expect(chat).toContain('overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]');
  });
});
