import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('deterministic conversation id support', () => {
  it('accepts native and deterministic conversation ids centrally', async () => {
    const s = await readFile('base44/shared/conversationIds.ts', 'utf8');
    expect(s).toContain("isBase44EntityId(id)");
    expect(s).toContain("(?:dm|group_request|public_room)_[0-9a-f]{64}");
  });

  it('uses the shared validator across message and conversation features', async () => {
    for (const path of [
      'base44/functions/manageConversation/entry.ts',
      'base44/functions/updateTypingStatus/entry.ts',
      'base44/functions/lockedChatVault/entry.ts',
      'base44/functions/callSummarySession/entry.ts',
      'base44/functions/sendConversationMessage/entry.ts',
      'base44/functions/mutateConversationMessage/entry.ts',
      'base44/functions/notifyOnMessage/entry.ts',
    ]) {
      const s = await readFile(path, 'utf8');
      expect(s).toContain("from '../../shared/conversationIds.ts'");
      expect(s).toContain('isConversationId');
    }
  });
});
