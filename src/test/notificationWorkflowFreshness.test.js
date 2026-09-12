// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('notification workflow freshness', () => {
  it('rejects replayed stale entity events before notification fan-out', async () => {
    const helper = await readText('base44/shared/workflowEvents.ts');
    expect(helper).toContain('workflowRecordIsFresh');
    expect(helper).toContain("kind === 'update' ? record?.updated_date : record?.created_date");
    expect(helper).toContain('10 * 60 * 1000');

    for (const path of [
      'base44/functions/notifyOnMessage/entry.ts',
      'base44/functions/notifyOnFileUpload/entry.ts',
      'base44/functions/notifyOnTrackComment/entry.ts',
      'base44/functions/notifyOnTrackVersion/entry.ts',
      'base44/functions/notifyOnMilestoneUpdate/entry.ts',
    ]) {
      const source = await readText(path);
      expect(source).toContain('workflowRecordIsFresh');
      expect(source).toContain("skipped: 'stale_workflow_record'");
      expect(source.indexOf('workflowRecordIsFresh(', source.indexOf('Deno.serve'))).toBeLessThan(
        source.indexOf('createNotificationIdempotently('),
      );
    }
  });
});
