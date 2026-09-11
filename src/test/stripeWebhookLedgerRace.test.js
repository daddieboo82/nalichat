// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Stripe webhook ledger race handling', () => {
  it('re-reads the ledger after a concurrent create collision', async () => {
    const source = await readText('base44/functions/stripeWebhook/entry.ts');

    expect(source).toContain('catch (createError)');
    expect(source).toContain('const raced = oneRecord(');
    expect(source).toContain('const racedAction = webhookLedgerAction(');
    expect(source).toContain("received: true, duplicate: true");
    expect(source).toContain("Event is already processing; retry later");
  });
});
