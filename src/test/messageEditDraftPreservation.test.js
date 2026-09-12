// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('message edit draft preservation', () => {
  it('awaits edits and keeps the draft when they fail', async () => {
    const input = await readText('src/components/messages/ChatInput.jsx');
    const chat = await readText('src/components/messages/ChatView.jsx');
    const page = await readText('src/pages/Messages.jsx');

    expect(input).toContain('const handleSend = async () =>');
    expect(input).toContain('await Promise.resolve(onSend(payload));');
    expect(input.indexOf('setText("");')).toBeGreaterThan(
      input.indexOf('await Promise.resolve(onSend(payload));'),
    );
    expect(chat).toContain('return onEditMessage(editingMessage.id, payload.text);');
    expect(page).toContain('editMessage.mutateAsync({ id, text, conversationId: selectedConvId })');
    expect(page).toContain('toast.error("Message edit failed. Your draft was kept so you can retry.")');
  });
});
