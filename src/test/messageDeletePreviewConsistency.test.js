// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('message delete preview consistency', () => {
  it('repairs conversation previews and supports idempotent repair retries', async () => {
    const backend = await readText('base44/functions/mutateConversationMessage/entry.ts');
    const chat = await readText('src/components/messages/ChatView.jsx');

    expect(backend).toContain('async function repairConversationPreview');
    expect(backend).toContain("action: 'delete'");
    expect(backend).toContain('userId: user.id');
    expect(backend).toContain('conversationId: message.conversation_id');
    expect(chat).toContain('res?.data?.messageId !== id');
    expect(chat).toContain('res?.data?.conversationId !== conversation?.id');
    expect(backend).toContain('already_deleted: true');
    expect(backend).toContain('repairConversationPreview');
    expect(backend).toContain('preview_refresh_failed: previewRefreshFailed');
    expect(backend).toContain('already_deleted: true');
    expect(chat).toContain('conversation_id: conversation?.id');
    expect(chat).toContain('if (res?.data?.preview_refresh_failed)');
  });
});
