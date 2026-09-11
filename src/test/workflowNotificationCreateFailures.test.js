// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('workflow notification create failures', () => {
  it('distinguishes deterministic duplicates from real persistence failures', async () => {
    const helper = await readText('base44/shared/workflowNotifications.ts');

    expect(helper).toContain('await notificationEntity.create(notification)');
    expect(helper).toContain('existing = await notificationEntity.get(notification.id)');
    expect(helper).toContain('if (existing)');
    expect(helper).toContain('throw createError');

    for (const path of [
      'base44/functions/notifyOnMessage/entry.ts',
      'base44/functions/notifyOnFileUpload/entry.ts',
      'base44/functions/notifyOnTrackComment/entry.ts',
      'base44/functions/notifyOnTrackVersion/entry.ts',
      'base44/functions/notifyOnMilestoneUpdate/entry.ts',
    ]) {
      const source = await readText(path);
      expect(source).toContain('createNotificationIdempotently');
      expect(source).not.toContain('await entities.Notification.create(notification)');
    }
  });
});
