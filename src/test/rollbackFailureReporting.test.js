// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('rollback failure reporting', () => {
  it('reports threaded message rollback and preview failures', async () => {
    const source = await readText('base44/functions/sendConversationMessage/entry.ts');

    expect(source).toContain('Thread reply count update failed and message rollback was incomplete. Please retry.');
    expect(source).toContain('preview_refresh_failed: previewRefreshFailed');
    expect(source).not.toContain('Message.delete(message.id).catch(() => {})');
    expect(source).not.toContain('catch (_) {}');
  });

  it('reports message deletion compensation failures', async () => {
    const source = await readText('base44/functions/mutateConversationMessage/entry.ts');

    expect(source).toContain('Message deletion failed and thread reply-count rollback was incomplete. Please retry.');
    expect(source).toContain('preview_refresh_failed: previewRefreshFailed');
    expect(source).not.toContain('thread_reply_count: 1 } },\n            ).catch(() => {});');
  });

  it('reports vote rollback failures', async () => {
    const source = await readText('base44/functions/castVote/entry.ts');

    expect(source).toContain('Vote count update failed and vote rollback was incomplete. Please retry.');
    expect(source).not.toContain('ChallengeVote.delete(id).catch(() => {})');
  });
});
