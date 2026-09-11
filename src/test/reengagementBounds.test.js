// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('reengagement candidate bounds', () => {
  it('targets only stalled users and caps each maintenance run', async () => {
    const source = await readText('base44/functions/reengageStalledUsers/entry.ts');

    expect(source).toContain('MAX_REENGAGEMENTS_PER_RUN = 500');
    expect(source).toMatch(/User\.filter\([\s\S]*onboarding_completed: false[\s\S]*reengagement_sent_at: null[\s\S]*created_date: \{ \$lt: oneDayAgo \}[\s\S]*MAX_REENGAGEMENTS_PER_RUN/);
    expect(source).not.toContain('User.list()');
  });
  it('allows only the daily scheduler window without weakening manual admin authorization', async () => {
    const source = await readText('base44/functions/reengageStalledUsers/entry.ts');
    const workflow = JSON.parse(await readText('base44/workflows/Re-engage Stalled Onboarding Users.jsonc'));

    expect(source).toContain("base44.auth.me().catch(() => null)");
    expect(source).toContain("caller.role !== 'admin'");
    expect(source).toContain("'nali-reengagement-scheduler'");
    expect(source).toContain("'scheduled_reengagement'");
    expect(source).toMatch(/'scheduled_reengagement',\s*1/);
    expect(source).toContain('now.getUTCHours() === 9');
    expect(workflow.trigger.config.cron_expression).toBe('0 9 * * *');
    expect(workflow.trigger.config.timezone).toBe('UTC');
  });

});
