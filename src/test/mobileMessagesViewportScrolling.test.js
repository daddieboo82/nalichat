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
    expect(messages).toContain('className="flex flex-1 min-h-0 flex-col overflow-hidden"');
    const list = await readFile('src/components/messages/ConversationList.jsx', 'utf8');
    expect(list).toContain('flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y');
  });

  it('enables native vertical touch scrolling in the message history and threads', async () => {
    const chat = await readFile('src/components/messages/ChatView.jsx', 'utf8');
    const thread = await readFile('src/components/messages/ThreadPanel.jsx', 'utf8');
    expect(chat).toContain('overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]');
    expect(thread).toContain('absolute inset-0 z-40 w-full h-full min-h-0');
    expect(thread).toContain('sm:static sm:z-auto sm:w-80');
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

  it('keeps contact controls fixed while the people list scrolls on mobile and desktop', async () => {
    const contacts = await readFile('src/components/messages/ContactsTab.jsx', 'utf8');
    expect(contacts).toContain('flex h-full min-h-0 flex-col overflow-hidden');
    expect(contacts).toContain('min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y');
    expect(contacts).toContain('[-webkit-overflow-scrolling:touch]');
    expect(contacts).toContain('pb-[max(5rem,env(safe-area-inset-bottom))]');
  });
});
