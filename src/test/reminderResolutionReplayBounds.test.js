// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('follow-up reminder resolution replay bounds', () => {
  it('rejects stale message-create workflow replays before reminder scans', async () => {
    const source = await readText('base44/functions/resolveFollowUpReminders/entry.ts');

    expect(source).toContain('workflowRecordIsFresh');
    expect(source).toContain("workflowRecordIsFresh(message, 'create')");
    expect(source).toContain("skipped: 'stale_workflow_record'");
    expect(source.indexOf("workflowRecordIsFresh(message, 'create')")).toBeLessThan(
      source.indexOf('resolveFollowUpRemindersForMessage'),
    );
  });
});
