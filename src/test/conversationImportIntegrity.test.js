import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('conversation import integrity', () => {
  for (const path of [
    'base44/functions/manageConversation/entry.ts',
    'base44/functions/lockedChatVault/entry.ts',
    'base44/functions/callSummarySession/entry.ts',
    'base44/functions/sendConversationMessage/entry.ts',
    'base44/functions/mutateConversationMessage/entry.ts',
  ]) {
    it(`${path} has valid top-level imports`, async () => {
      const source = await readFile(path, 'utf8');
      expect(source).toContain("import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';");
      expect(source).toContain("import { isConversationId } from '../../shared/conversationIds.ts';");
      expect(source).not.toContain("import {\nimport { isConversationId");
      expect(source).not.toContain("conversationIds.ts'; createClientFromRequest");
    });
  }
});
