// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('due reminder processor deduplication', () => {
  it('limits processing to the five-minute workflow cadence', async () => {
    const source = await readText('base44/functions/processDueFollowUpReminders/entry.ts');

    expect(source).toContain('claimFixedWindow');
    expect(source).toContain("'follow-up-reminder-processor'");
    expect(source).toContain('5 * 60');
    expect(source).toContain("skipped: 'already_processed_this_window'");
    expect(source.indexOf('claimFixedWindow')).toBeLessThan(
      source.indexOf('processDueFollowUpReminders({'),
    );
  });
});
