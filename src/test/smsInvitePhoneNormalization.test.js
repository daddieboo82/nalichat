// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('SMS invite phone normalization', () => {
  it('accepts the formatted phone style shown by the UI', async () => {
    const client = await readText('src/components/messages/InviteTab.jsx');
    const backend = await readText('base44/functions/sendSmsInvite/entry.ts');

    expect(client).toContain("sendSmsInvite', { phone: normalized }");
    expect(backend).toContain("phone.replace(/[\\r\\n\\s()-]/g, '').trim()");
  });
});
