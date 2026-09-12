// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('SMS invite abuse protection', () => {
  it('opens the user-owned SMS client instead of invoking a server-funded relay', async () => {
    const client = await readText('src/components/messages/InviteTab.jsx');
    const backend = await readText('base44/functions/sendSmsInvite/entry.ts');

    expect(client).toContain("const normalized = trimmed.replace(/[\\s()-]/g, '')");
    expect(client).toContain('window.location.href = `sms:');
    expect(client).not.toContain("functions.invoke('sendSmsInvite'");
    expect(backend).toContain('INVITE_RELAY_DISABLED');
    expect(backend).not.toContain('TWILIO_ACCOUNT_SID');
  });
});
