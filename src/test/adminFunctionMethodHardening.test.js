// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const ADMIN_FUNCTIONS = [
  'base44/functions/makeAdmin/entry.ts',
  'base44/functions/syncToSupabase/entry.ts',
  'base44/functions/nali-maintenance/entry.ts',
  'base44/functions/getAdminDashboardStats/entry.ts',
  'base44/functions/migrateUserRoles/entry.ts',
  'base44/functions/backfillTrackAccess/entry.ts',
];

describe('admin function method hardening', () => {
  it('requires POST before privileged work', async () => {
    for (const path of ADMIN_FUNCTIONS) {
      const source = await readText(path);
      expect(source).toContain("if (req.method !== 'POST')");
      expect(source).toContain("Method not allowed");
      expect(source).toContain("status: 405");
    }
  });

  it('blocks banned and timed-out admins from Supabase sync', async () => {
    const source = await readText('base44/functions/syncToSupabase/entry.ts');
    expect(source).toContain("if (user.is_banned)");
    expect(source).toContain("user.timeout_until");
    expect(source).toContain("error: 'timed_out'");
  });
});
