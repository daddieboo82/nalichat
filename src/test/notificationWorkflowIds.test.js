// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('entity workflow notification ids', () => {
  it('prefers canonical workflow entity ids and rejects conflicting envelopes', async () => {
    const helper = await readText('base44/shared/workflowEvents.ts');
    expect(helper).toContain('body?.event?.entity_id');
    expect(helper).toContain('body?.event?.id');
    expect(helper).toContain('body?.data?.id');
    expect(helper).toContain('conflict: unique.length > 1');

    for (const path of [
      'base44/functions/notifyOnMessage/entry.ts',
      'base44/functions/notifyOnFileUpload/entry.ts',
      'base44/functions/notifyOnTrackComment/entry.ts',
      'base44/functions/notifyOnTrackVersion/entry.ts',
      'base44/functions/notifyOnMilestoneUpdate/entry.ts',
    ]) {
      const source = await readText(path);
      expect(source).toContain('workflowEntityRecordId({ event, data })');
      expect(source).toContain("Conflicting entity ids");
      expect(source).not.toMatch(/\.get\(data\.id\)/);
    }
  });
});
