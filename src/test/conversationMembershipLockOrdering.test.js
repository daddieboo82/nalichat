import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('conversation membership lock ordering', () => {
  it('accepts canonical and deterministic conversation ids only', async () => {
    const source = await readFile('base44/functions/manageConversation/entry.ts', 'utf8');
    const ids = await readFile('base44/shared/conversationIds.ts', 'utf8');
    expect(source).toContain("import { isConversationId } from '../../shared/conversationIds.ts';");
    expect(ids).toContain('export function isConversationId');
    expect(ids).toContain('(?:dm|group_request|public_room)_[0-9a-f]{64}');
  });
  it('authorizes membership actions before acquiring the conversation lock', async () => {
    const source = await readFile('base44/functions/manageConversation/entry.ts', 'utf8');
    const preview = source.indexOf('const conversationPreview = await entities.Conversation.get(conversationId)');
    const auth = source.indexOf("['leave', 'rename'].includes(action) && !previewIsParticipant");
    const lock = source.indexOf('membershipLockId = await acquireConversationMembershipLock(entities, conversationId)');
    expect(preview).toBeGreaterThan(-1); expect(auth).toBeGreaterThan(preview); expect(auth).toBeLessThan(lock);
  });
});
