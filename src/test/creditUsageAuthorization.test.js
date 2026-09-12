// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('credit-spending workflow authorization', () => {
  it('requires a scheduler credential for anonymous health-check runs', async () => {
    const source = await readText('base44/functions/naliHealthCheck/entry.ts');
    expect(source).toContain('SCHEDULE_KEY_SHA256');
    expect(source).toContain('validScheduleKey(body?.workflow_key)');
    expect(source.indexOf('validScheduleKey(body?.workflow_key)')).toBeLessThan(source.indexOf('integrations.Core.InvokeLLM'));
    expect(source.indexOf('validScheduleKey(body?.workflow_key)')).toBeLessThan(source.indexOf('integrations.Core.SendEmail'));
  });

  it('requires a scheduler credential for anonymous re-engagement email runs', async () => {
    const source = await readText('base44/functions/reengageStalledUsers/entry.ts');
    expect(source).toContain('SCHEDULE_KEY_SHA256');
    expect(source).toContain('validScheduleKey(body?.workflow_key)');
    expect(source.indexOf('validScheduleKey(body?.workflow_key)')).toBeLessThan(source.indexOf('integrations.Core.SendEmail'));
  });

  it('keeps scheduler credentials out of the callable function source', async () => {
    const healthSource = await readText('base44/functions/naliHealthCheck/entry.ts');
    const reengageSource = await readText('base44/functions/reengageStalledUsers/entry.ts');
    const healthWorkflow = await readText('base44/workflows/Nali Weekly Health Check.jsonc');
    const reengageWorkflow = await readText('base44/workflows/Re-engage Stalled Onboarding Users.jsonc');

    const healthKey = JSON.parse(healthWorkflow).definition.do[0].run_function.with.args.workflow_key;
    const reengageKey = JSON.parse(reengageWorkflow).definition.do[0].run_function.with.args.workflow_key;

    expect(healthKey.length).toBeGreaterThanOrEqual(32);
    expect(reengageKey.length).toBeGreaterThanOrEqual(32);
    expect(healthSource).not.toContain(healthKey);
    expect(reengageSource).not.toContain(reengageKey);
  });
});
