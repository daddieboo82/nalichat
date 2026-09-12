import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('follow-up reminder workflow authorization', () => {
  it('requires a credential before scheduled service-role processing', async () => {
    const source = await readFile('base44/functions/processDueFollowUpReminders/entry.ts', 'utf8');
    expect(source).toContain('WORKFLOW_KEY_SHA256');
    expect(source).toContain('validWorkflowKey(body?.workflow_key, WORKFLOW_KEY_SHA256)');
    expect(source.indexOf('validWorkflowKey(body?.workflow_key')).toBeLessThan(
      source.indexOf('claimFixedWindow('),
    );
  });

  it('requires a credential before entity-workflow service-role reads', async () => {
    const source = await readFile('base44/functions/resolveFollowUpReminders/entry.ts', 'utf8');
    expect(source).toContain('WORKFLOW_KEY_SHA256');
    expect(source).toContain('validWorkflowKey(workflow_key, WORKFLOW_KEY_SHA256)');
    expect(source.indexOf('validWorkflowKey(workflow_key')).toBeLessThan(
      source.indexOf('asServiceRole.entities.Message.filter'),
    );
  });

  it('configures both Base44 workflows to send their credentials', async () => {
    const scheduled = await readFile('base44/workflows/Process Due Follow-up Reminders.jsonc', 'utf8');
    const resolver = await readFile('base44/workflows/Resolve Follow-up Reminders.jsonc', 'utf8');
    expect(scheduled).toContain('"workflow_key"');
    expect(resolver).toContain('"workflow_key"');
    expect(scheduled).not.toContain('"args": {}');
    expect(resolver).not.toContain('"args": {}');
  });
});
