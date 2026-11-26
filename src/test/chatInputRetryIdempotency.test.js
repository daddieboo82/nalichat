// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('ChatInput retry idempotency', () => {
  it('reuses the original send key for a manual retry of the same draft and reply', async () => {
    const source = await readFile('src/components/messages/ChatInput.jsx', 'utf8');
    expect(source).toContain('const pendingTextSendRef = useRef(null);');
    expect(source).toContain('const clientMessageKey = pending?.text === submittedText && pending?.replyId === replyId');
    expect(source).toContain('if (!editingMessage) payload.client_message_key = clientMessageKey;');
    expect(source).toContain('if (!editingMessage) pendingTextSendRef.current = { text: submittedText, replyId, key: clientMessageKey };');
  });

  it('gives edited draft text a new key and retires successful keys', async () => {
    const source = await readFile('src/components/messages/ChatInput.jsx', 'utf8');
    expect(source).toContain('if (pendingTextSendRef.current?.text !== e.target.value)');
    expect(source).toContain('pendingTextSendRef.current = null;');
    expect(source).toContain('if (pendingTextSendRef.current?.key === clientMessageKey)');
    expect(source).toContain('await Promise.resolve(onSend(payload));');
  });

  it('retains server-side send idempotency and queue deduplication', async () => {
    const backend = await readFile('base44/functions/sendConversationMessage/entry.ts', 'utf8');
    const queue = await readFile('src/lib/outboundQueue.js', 'utf8');
    expect(backend).toContain('findExistingMessage(base44, user.id, conversationId, clientMessageKey)');
    expect(queue).toContain('item.clientMessageKey === entry.clientMessageKey');
  });
});
