import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const pairs = [
  ['base44/functions/notifyOnFileUpload/entry.ts', 'base44/workflows/Notify on File Upload.jsonc'],
  ['base44/functions/notifyOnTrackComment/entry.ts', 'base44/workflows/Notify on Track Comment.jsonc'],
  ['base44/functions/notifyOnTrackVersion/entry.ts', 'base44/workflows/Notify on Track Version Upload.jsonc'],
  ['base44/functions/notifyOnMessage/entry.ts', 'base44/workflows/Notify on Group Message.jsonc'],
  ['base44/functions/notifyOnMilestoneUpdate/entry.ts', 'base44/workflows/Notify on Milestone Update.jsonc'],
];

describe('notification workflow authorization', () => {
  for (const [functionPath, workflowPath] of pairs) {
    it(`${functionPath} requires the configured workflow credential`, async () => {
      const source = await readFile(functionPath, 'utf8');
      const workflow = await readFile(workflowPath, 'utf8');
      expect(source).toContain("import { validWorkflowKey } from '../../shared/workflowAuth.ts';");
      expect(source).toContain('WORKFLOW_KEY_SHA256');
      expect(source).toContain('validWorkflowKey(workflow_key, WORKFLOW_KEY_SHA256)');
      expect(source.indexOf('validWorkflowKey(workflow_key')).toBeLessThan(
        source.indexOf('asServiceRole.entities'),
      );
      expect(workflow).toContain('"workflow_key"');
      expect(workflow).not.toContain('"args": {}');
    });
  }
});
