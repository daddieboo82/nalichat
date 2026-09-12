// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('optimistic send preview rollback', () => {
  it('restores conversation previews when sends fail or are moderated', async () => {
    const source = await readText('src/pages/Messages.jsx');

    expect(source).toContain('const previousConversations = queryClient.getQueryData(["conversations"]);');
    expect(source).toContain('return { previous, previousConversations, tempId, clientMessageKey, conversationId };');
    expect(source.match(/queryClient\.setQueryData\(\["conversations"\], ctx\.previousConversations\);/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
