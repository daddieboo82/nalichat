import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message notification audience hardening', () => {
  it('notifies only send-time participants who are still in the conversation', async () => {
    const s = await readFile('base44/functions/notifyOnMessage/entry.ts', 'utf8');
    expect(s).toContain('const currentParticipantIds = new Set(');
    expect(s).toContain('const sentParticipantIds = Array.isArray(message.participant_ids)');
    expect(s).toContain('currentParticipantIds.has(id)');
    expect(s).not.toContain('for (const id of conversation.participant_ids || [])');
  });

  it('paginates locked-chat preferences before deciding whether notification content must be redacted', async () => {
    const s = await readFile('base44/functions/notifyOnMessage/entry.ts', 'utf8');
    expect(s).toContain('for (let skip = 0; ; skip += 200)');
    expect(s).toContain("entities.LockedConversationPreference.filter(");
    expect(s).toContain('lockPreferences.push(...page)');
    expect(s).toContain('if (page.length < 200) break');
  });
});
