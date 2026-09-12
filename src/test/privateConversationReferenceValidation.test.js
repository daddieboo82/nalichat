import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('private conversation reference validation', () => {
  it('deletes invalid locked-chat preferences before conversation lookup', async () => {
    const s=await readFile('base44/functions/lockedChatVault/entry.ts','utf8');
    const check=s.indexOf('!isBase44EntityId(preference.conversation_id)');
    const lookup=s.indexOf('Conversation.get(preference.conversation_id)');
    expect(check).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(check);
  });
  it('validates call-summary stored conversation ids before lookup', async () => {
    const s=await readFile('base44/functions/callSummarySession/entry.ts','utf8');
    const check=s.indexOf('!isBase44EntityId(session.conversation_id)');
    const lookup=s.indexOf('loadConversation(entities, session.conversation_id)');
    expect(check).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(check);
  });
});
