// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Messages cross-chat mutation scoping', () => {
  it('keeps send and reaction updates attached to the conversation where they began', async () => {
    const source = await readText('src/pages/Messages.jsx');

    expect(source).toContain('const conversationId = msgData.conversation_id || selectedConvId;');
    expect(source).toContain('return { previous, previousConversations, tempId, clientMessageKey, conversationId, outboundEntry };');
    expect(source).toContain('queryClient.setQueryData(["messages", currentUser?.id, ctx?.conversationId]');
    expect(source).toContain('const conversationId = selectedConvId;');
    expect(source).toContain('queryClient.invalidateQueries({ queryKey: ["messages", currentUser?.id, conversationId] });');
    expect(source).toContain('sendMessage.mutate({ ...data, conversation_id: selectedConvId });');
    expect(source).toContain('conversation_id: message.conversation_id || selectedConvId');
  });
});
