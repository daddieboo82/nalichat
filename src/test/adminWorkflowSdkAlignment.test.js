import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('admin and workflow backend SDK alignment', () => {
  it('uses Base44 SDK 0.8.44 across sensitive admin, invite, payment, and workflow endpoints', async () => {
    const paths = [
      'base44/functions/makeAdmin/entry.ts',
      'base44/functions/sendSmsInvite/entry.ts',
      'base44/functions/send-invite-email/entry.ts',
      'base44/functions/getAdminDashboardStats/entry.ts',
      'base44/functions/manageCollaboration/entry.ts',
      'base44/functions/wixPaymentsWebhook/entry.ts',
      'base44/functions/onNewContent/entry.ts',
      'base44/functions/generateNetworkProfiles/entry.ts',
      'base44/functions/backfillTrackAccess/entry.ts',
    ];
    for (const path of paths) {
      const source = await readFile(path, 'utf8');
      expect(source).toContain('npm:@base44/sdk@0.8.44');
      expect(source).not.toContain('npm:@base44/sdk@0.8.31');
    }
  });
});
