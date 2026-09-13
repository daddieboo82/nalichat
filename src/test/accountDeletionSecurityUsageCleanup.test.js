import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('account deletion security and usage cleanup', () => {
  it('hard-deletes account-owned locked-chat credentials/reset state and AI usage rows', async () => {
    const s = await readFile('base44/functions/deleteMyAccount/entry.ts', 'utf8');
    expect(s).toContain("['LockedChatSecurity', 'user_id']");
    expect(s).toContain("['LockedChatResetChallenge', 'user_id']");
    expect(s).toContain("['AIUsage', 'user_id']");
    expect(s).toContain("['LockedConversationPreference', 'user_id']");
    expect(s).toContain("['FollowUpReminder', 'owner_id']");
  });
});
