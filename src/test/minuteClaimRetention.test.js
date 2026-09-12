// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('scheduled claim retention', () => {
  it('uses deterministic fixed-window claims and cleans the previous window', async () => {
    const rateLimit = await readText('base44/shared/rateLimit.ts');
    const processor = await readText('base44/functions/processDueFollowUpReminders/entry.ts');

    expect(rateLimit).toContain('export async function claimFixedWindow');
    expect(rateLimit).toContain("'window_' + await sha256Hex");
    expect(rateLimit).toContain('await entities.UsageRateLimit.delete(previousId)');
    expect(rateLimit).toContain('action: `fixed_window_${minutes}m`');
    expect(processor).toContain('claimFixedWindow');
    expect(processor).toContain('5 * 60');
    expect(processor).not.toContain('consumeHourlyLimit');
  });
});
