// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('due reminder processor deduplication', () => {
  it('durably limits processing to one claim per UTC minute', async () => {
    const source = await readText('base44/functions/processDueFollowUpReminders/entry.ts');

    expect(source).toContain('consumeHourlyLimit');
    expect(source).toContain("new Date().toISOString().slice(0, 16)");
    expect(source).toContain("'process_due_follow_up_reminders'");
    expect(source).toMatch(/'process_due_follow_up_reminders',\s*1/);
    expect(source).toContain("skipped: 'already_processed_this_minute'");
    expect(source.indexOf('consumeHourlyLimit')).toBeLessThan(
      source.indexOf('processDueFollowUpReminders({'),
    );
  });
});
