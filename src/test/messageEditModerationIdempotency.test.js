import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message edit moderation idempotency', () => {
  it('derives a deterministic edit request key in the client', async () => {
    const s = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(s).toContain('async function messageEditRequestKey(messageId, text)');
    expect(s).toContain('crypto.subtle.digest("SHA-256", input)');
    expect(s).toContain('client_request_key: clientRequestKey');
    expect(s).toContain('res?.data?.action !== "edit"');
    expect(s).toContain('res?.data?.userId !== currentUser?.id');
    expect(s).toContain('res?.data?.clientRequestKey !== clientRequestKey');
  });

  it('replays prior edit moderation under the message lock before re-moderating', async () => {
    const s = await readFile('base44/functions/mutateConversationMessage/entry.ts', 'utf8');
    const lock = s.indexOf('const lockId = await acquireMessageMutationLock');
    const replay = s.indexOf('const replayedModeration = await findEditModerationReplay', lock);
    const moderate = s.indexOf('const moderation = await moderateEditedText', replay);
    const update = s.indexOf('const updated = await entities.Message.update', moderate);

    expect(lock).toBeGreaterThan(-1);
    expect(replay).toBeGreaterThan(lock);
    expect(moderate).toBeGreaterThan(replay);
    expect(update).toBeGreaterThan(moderate);
    expect(s).toContain('message_id: messageId');
    expect(s).toContain('client_message_key: clientRequestKey');
    expect(s).toContain('Valid client_request_key is required for edits');
  });
});
