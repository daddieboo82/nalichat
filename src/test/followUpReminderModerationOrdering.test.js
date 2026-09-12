import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('follow-up reminder moderation ordering', () => {
  it('blocks restricted reschedules before reminder lookup', async () => {
    const source = await readFile('base44/shared/followUpReminders.ts', 'utf8');
    const start = source.indexOf('export async function rescheduleFollowUpReminder');
    const end = source.indexOf('export async function cancelFollowUpReminder');
    const block = source.slice(start, end);
    expect(block).toContain('if (isOwnerBlocked(user, clock))');
    expect(block.indexOf('if (isOwnerBlocked(user, clock))')).toBeLessThan(block.indexOf('requireOwnedScheduledReminder('));
  });

  it('blocks restricted cancellations before reminder lookup', async () => {
    const source = await readFile('base44/shared/followUpReminders.ts', 'utf8');
    const start = source.indexOf('export async function cancelFollowUpReminder');
    const end = source.indexOf('export async function resolveFollowUpRemindersForMessage');
    const block = source.slice(start, end);
    expect(block).toContain('if (isOwnerBlocked(user, clock))');
    expect(block.indexOf('if (isOwnerBlocked(user, clock))')).toBeLessThan(block.indexOf('findById(entities.FollowUpReminder, id)'));
  });
});
