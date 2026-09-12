// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('message edit conversation scoping', () => {
  it('refreshes the conversation where the edit started', async () => {
    const source = await readText('src/pages/Messages.jsx');

    expect(source).toContain('onSettled: async (_data, _error, variables) =>');
    expect(source).toContain('queryKey: ["messages", currentUser?.id, variables.conversationId]');
    expect(source).toContain('editMessage.mutateAsync({ id, text, conversationId: selectedConvId })');
  });
});
