import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('follow-up reminder wrapper rate limits', () => {
  it('rate-limits list reads before helper service-role work', async () => {
    const source = await readFile('base44/functions/listFollowUpReminders/entry.ts', 'utf8');
    expect(source).toContain("'follow_up_reminder_list'");
    expect(source).toContain('300');
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(source.indexOf('listFollowUpReminders({'));
  });

  for (const path of [
    'base44/functions/createFollowUpReminder/entry.ts',
    'base44/functions/cancelFollowUpReminder/entry.ts',
    'base44/functions/rescheduleFollowUpReminder/entry.ts',
  ]) {
    it(`rate-limits reminder mutation wrapper ${path}`, async () => {
      const source = await readFile(path, 'utf8');
      expect(source).toContain("'follow_up_reminder_mutation'");
      expect(source).toContain('120');
      expect(source.indexOf('consumeHourlyLimit(')).toBeGreaterThan(-1);
    });
  }
});
