// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('workflow handler HTTP methods', () => {
  it('rejects non-POST traffic before service-role work', async () => {
    for (const path of [
      'base44/functions/notifyOnMessage/entry.ts',
      'base44/functions/notifyOnFileUpload/entry.ts',
      'base44/functions/notifyOnMilestoneUpdate/entry.ts',
      'base44/functions/notifyOnTrackComment/entry.ts',
      'base44/functions/notifyOnTrackVersion/entry.ts',
      'base44/functions/resolveFollowUpReminders/entry.ts',
      'base44/functions/suggestTrackTags/entry.ts',
    ]) {
      const source = await readText(path);
      expect(source).toContain("req.method !== 'POST'");
      expect(source.indexOf("req.method !== 'POST'")).toBeLessThan(
        source.indexOf('createClientFromRequest(req)'),
      );
    }
  });
});
