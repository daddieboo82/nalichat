import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('admin maintenance error disclosure', () => {
  it('sanitizes access backfill failures', async () => {
    const source = await readFile('base44/functions/backfillTrackAccess/entry.ts', 'utf8');
    expect(source).toContain("return Response.json({ error: 'Backfill failed' }, { status: 500 });");
    expect(source).not.toContain("error?.message || 'Backfill failed'");
  });

  it('does not return Supabase provider/database exception text', async () => {
    const source = await readFile('base44/functions/syncToSupabase/entry.ts', 'utf8');
    expect(source).toContain("error: 'Sync failed'");
    expect(source).not.toContain("error: e.message");
  });

  it('does not return stalled-user emails or delivery exceptions', async () => {
    const source = await readFile('base44/functions/reengageStalledUsers/entry.ts', 'utf8');
    expect(source).toContain('errorCount: errors.length');
    expect(source).not.toContain('errors: errors.slice');
    expect(source).not.toContain("errors.push(`${user.email}: ${err.message}`)");
    expect(source).not.toContain("(${user.email}):");
  });
});
