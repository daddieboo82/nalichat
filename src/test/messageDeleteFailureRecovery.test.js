// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('message delete failure recovery', () => {
  it('restores the message, composer context, and reports the failure', async () => {
    const source = await readText('src/components/messages/ChatView.jsx');

    expect(source).toContain('const previousEditingMessage = editingMessage;');
    expect(source).toContain('const previousReplyTo = replyTo;');
    expect(source).toContain('setEditingMessage(previousEditingMessage);');
    expect(source).toContain('setReplyTo(previousReplyTo);');
    expect(source).toContain('toast.error("Couldn\'t delete the message. Please try again.");');
  });
});
