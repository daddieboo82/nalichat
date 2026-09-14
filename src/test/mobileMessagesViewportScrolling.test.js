// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('mobile Messages viewport scrolling', () => {
  it('uses the dynamic viewport and a bounded chat pane', async () => {
    const layout = await readFile('src/components/layout/AppLayout.jsx', 'utf8');
    const messages = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(layout).toContain('h-screen h-[100dvh]');
    expect(layout).toContain("scroll={!location.pathname.startsWith('/messages')}");
    expect(messages).toContain('flex-1 h-full min-h-0 flex flex-col');
  });

  it('enables native vertical touch scrolling in the message history and threads', async () => {
    const chat = await readFile('src/components/messages/ChatView.jsx', 'utf8');
    const thread = await readFile('src/components/messages/ThreadPanel.jsx', 'utf8');
    expect(chat).toContain('overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]');
    expect(thread).toContain('w-full sm:w-80 h-full min-h-0');
    expect(thread).toContain('overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]');
  });

  it('does not let pull-to-refresh steal gestures from a nested scroller', async () => {
    const pull = await readFile('src/components/layout/PullToRefresh.jsx', 'utf8');
    expect(pull).toContain('window.getComputedStyle(node)');
    expect(pull).toContain('node.scrollHeight > node.clientHeight');
    expect(pull).toContain('activeScrollerRef.current = scroller || wrapper');
    expect(pull).toContain('activeScrollerRef.current.scrollTop <= 0');
  });

  it('keeps message search inside the dynamic viewport with native touch scrolling', async () => {
    const search = await readFile('src/components/messages/MessageSearch.jsx', 'utf8');
    expect(search).toContain('max-h-[85dvh]');
    expect(search).toContain('overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]');
  });
});
