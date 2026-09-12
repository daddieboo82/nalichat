import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('locked chat deterministic conversation ids', () => {
  it('does not delete deterministic conversation preferences as invalid', async () => {
    const s = await readFile('base44/functions/lockedChatVault/entry.ts', 'utf8');
    expect(s).toContain('isConversationId(preference.conversation_id)');
    expect(s).not.toContain('isBase44EntityId(preference.conversation_id)');
  });
});
