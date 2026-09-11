// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('follow-up reminder recovery bounds', () => {
  it('loads only stale unfinalized trigger claims', async () => {
    const source = await readText('base44/shared/followUpReminders.ts');

    expect(source).toContain("status: 'triggered'");
    expect(source).toContain("triggered_at: null");
    expect(source).toContain("last_attempt_at: { $lte: staleClaimCutoff }");
    expect(source).not.toContain("loadAll(entities.FollowUpReminder, { status: 'triggered' })");
    expect(source).toContain("const [scheduled, recoverableClaims] = await Promise.all");
  });
});
