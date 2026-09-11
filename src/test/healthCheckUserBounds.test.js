// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('health-check user scan bounds', () => {
  it('uses a bounded user snapshot and a targeted admin query', async () => {
    const source = await readText('base44/functions/naliHealthCheck/entry.ts');

    expect(source).toContain("User.list('-created_date', 200)");
    expect(source).toContain("User.filter({ role: 'admin' }, '-created_date', 100)");
    expect(source).not.toContain('User.list()');
    expect(source).not.toContain("users.filter(u => u.role === 'admin')");
  });
  it('keeps scheduled health checks timezone-aware and tightly authorized', async () => {
    const source = await readText('base44/functions/naliHealthCheck/entry.ts');
    const workflow = JSON.parse(await readText('base44/workflows/Nali Weekly Health Check.jsonc'));

    expect(source).toContain("const SCHEDULE_TIME_ZONE = 'America/New_York'");
    expect(source).toContain("base44.auth.me().catch(() => null)");
    expect(source).toContain("'nali-health-scheduler'");
    expect(source).toContain("'scheduled_health_check'");
    expect(source).toMatch(/'scheduled_health_check',\s*1/);
    expect(source).toContain("values.weekday === 'Sun'");
    expect(source).toContain('Number(values.hour) === 4');

    expect(workflow.trigger.config.cron_expression).toBe('0 4 * * 0');
    expect(workflow.trigger.config.timezone).toBe('America/New_York');
  });

});
