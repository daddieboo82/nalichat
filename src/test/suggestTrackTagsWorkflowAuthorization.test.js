import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('suggestTrackTags workflow authorization', () => {
  it('requires a credential on the anonymous automation path', async () => {
    const source = await readFile('base44/functions/suggestTrackTags/entry.ts', 'utf8');
    expect(source).toContain('WORKFLOW_KEY_SHA256');
    expect(source).toContain('validWorkflowKey(body?.workflow_key, WORKFLOW_KEY_SHA256)');
    expect(source.indexOf('validWorkflowKey(body?.workflow_key')).toBeLessThan(
      source.indexOf('isCreateAutomation'),
    );
  });

  it('ships an explicit Track-create workflow with a credential', async () => {
    const workflow = await readFile('base44/workflows/Suggest Track Tags.jsonc', 'utf8');
    expect(workflow).toContain('"entity_name": "Track"');
    expect(workflow).toContain('"function_name": "suggestTrackTags"');
    expect(workflow).toContain('"workflow_key"');
  });
});
