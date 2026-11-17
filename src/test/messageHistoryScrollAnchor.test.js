import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message history scroll anchoring', () => {
  it('keeps the visible message anchored when older history is prepended', async () => {
    const s = await readFile('src/components/messages/ChatView.jsx', 'utf8');
    // Anchoring lives in the useChatScroll hook, which owns the scroll element.
    const scroll = await readFile('src/hooks/useChatScroll.js', 'utf8');
    expect(scroll).toContain('const historyAnchorRef = useRef(null);');
    expect(scroll).toContain('{ height: el.scrollHeight, top: el.scrollTop }');
    expect(scroll).toContain('el.scrollTop = top + Math.max(0, el.scrollHeight - height);');
    expect(s).toContain('onClick={loadOlderMessages}');
  });
});