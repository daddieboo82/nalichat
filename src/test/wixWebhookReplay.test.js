// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

describe('Wix webhook replay protection', () => {
  it('claims a durable event key before mutation and releases failed claims', async () => {
    const source = await readText('base44/functions/wixPaymentsWebhook/entry.ts');
    const schema = await readJson('base44/entities/WixWebhookEvent.jsonc');

    expect(schema.rls.read?.user_condition?.role).toBe('admin');
    expect(source).toContain('eventData?.id');
    expect(source).toContain('legacy:');
    expect(source).toContain('WixWebhookEvent');
    expect(source).toContain('duplicate: true');
    expect(source).toContain('await wixEventEntity.delete(wixEventClaimId)');
    expect(source.indexOf('wixEventEntity.create')).toBeLessThan(
      source.indexOf('Subscription.filter'),
    );
  });
});
