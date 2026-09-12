// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('outbound message input hardening', () => {
  it('requires POST and validates recipient/message types before provider calls', async () => {
    const external = await readText('base44/functions/sendExternalMessage/entry.ts');
    expect(external).toContain("req.method !== 'POST'");
    expect(external).toContain("typeof destination !== 'string'");
    expect(external).toContain("typeof message !== 'string'");
    expect(external).toContain('destination.length > 320');
    expect(external).toContain('message.length > 5000');

    const email = await readText('base44/functions/send-invite-email/entry.ts');
    expect(email).toContain("req.method !== 'POST'");
    expect(email).toContain("typeof to !== 'string'");
    expect(email).toContain('to.length > 320');

    const sms = await readText('base44/functions/sendSmsInvite/entry.ts');
    expect(sms).toContain("req.method !== 'POST'");
    expect(sms).toContain("typeof phone !== 'string'");
    expect(sms).toContain('phone.length > 32');
  });
});
