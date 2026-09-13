import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('public room discovery', () => {
  it('queries public rooms separately from the current user conversation list', async () => {
    const s = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(s).toContain('queryKey: ["public-conversations"]');
    expect(s).toContain('{ type: "group", is_public: true }');
    expect(s).toContain('const discoveryConversations = [');
    expect(s).toContain('conversations={discoveryConversations}');
    expect(s).toContain('queryClient.invalidateQueries({ queryKey: ["public-conversations"] })');
  });
});
