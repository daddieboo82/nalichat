import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('account deletion private chat cleanup', () => {
  it('removes account-owned locked-chat/reminder state and wipes call-summary content', async () => {
    const s = await readFile('base44/functions/deleteMyAccount/entry.ts', 'utf8');
    expect(s).toContain("['LockedConversationPreference', 'user_id']");
    expect(s).toContain("['FollowUpReminder', 'owner_id']");
    expect(s).toContain('entities.CallSummarySession');
    expect(s).toContain("audio_url: ''");
    expect(s).toContain("transcript: ''");
    expect(s).toContain("summary: ''");
    expect(s).toContain('action_items: []');
    expect(s).toContain("failure_code: 'OWNER_DELETED'");
    expect(s).toContain("{ participant_id: user.id }");
    expect(s).toContain("{ participant_ids: user.id }");
  });
});
