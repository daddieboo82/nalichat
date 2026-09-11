// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('minute claim retention', () => {
  it('uses deterministic minute claims and cleans the previous minute', async () => {
    const rateLimit = await readText('base44/shared/rateLimit.ts');
    const processor = await readText('base44/functions/processDueFollowUpReminders/entry.ts');

    expect(rateLimit).toContain('export async function claimMinuteWindow');
    expect(rateLimit).toContain("'minute_' + await sha256Hex");
    expect(rateLimit).toContain('await entities.UsageRateLimit.delete(previousId)');
    expect(rateLimit).toContain("action: 'minute_claim'");
    expect(processor).toContain('claimMinuteWindow');
    expect(processor).not.toContain('consumeHourlyLimit');
  });
});
