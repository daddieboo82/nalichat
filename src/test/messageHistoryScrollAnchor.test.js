import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message history scroll anchoring', () => {
  it('keeps the visible message anchored when older history is prepended', async () => {
    const s = await readFile('src/components/messages/ChatView.jsx', 'utf8');
    expect(s).toContain('const historyAnchorRef = useRef(null);');
    expect(s).toContain('height: scrollRef.current.scrollHeight');
    expect(s).toContain('top: scrollRef.current.scrollTop');
    expect(s).toContain('const addedHeight = scrollRef.current.scrollHeight - height;');
    expect(s).toContain('scrollRef.current.scrollTop = top + Math.max(0, addedHeight);');
    expect(s).toContain('onClick={loadOlderMessages}');
  });
});
