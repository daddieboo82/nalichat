// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('final Messages backend hardening', () => {
  it('authorizes chat-session track mutations from current Conversation membership', async () => {
    const source = await readText('base44/functions/mutateTrack/entry.ts');
    expect(source).toContain('acquireConversationMembershipLock');
    expect(source).toContain('entities.Message.get(track.project_id)');
    expect(source).toContain('entities.Conversation.get(sessionConversationId)');
    expect(source).toContain('participantIds.includes(user.id)');
    expect(source).not.toContain('sessionMessage.participant_ids.includes(user.id)');
  });

  it('requires POST on message-related mutation/read endpoints', async () => {
    for (const path of [
      'base44/functions/authorizeMessageDownload/entry.ts',
      'base44/functions/searchMessages/entry.ts',
      'base44/functions/lockedChatVault/entry.ts',
      'base44/functions/updateUserPresence/entry.ts',
    ]) {
      const source = await readText(path);
      expect(source).toContain("req.method !== 'POST'");
      expect(source).toContain('405');
    }
  });

  it('rate limits download authorization and validates presence payloads', async () => {
    const download = await readText('base44/functions/authorizeMessageDownload/entry.ts');
    const presence = await readText('base44/functions/updateUserPresence/entry.ts');

    expect(download).toContain("'message_download_authorization'");
    expect(download).toContain('600');
    expect(presence).toContain("typeof isOnline !== 'boolean'");
    expect(presence).toContain("'isOnline must be a boolean'");
  });
});
