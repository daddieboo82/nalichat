// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('SMS provider error exposure', () => {
  it('keeps the deprecated server-funded SMS relay disabled and provider details server-side', async () => {
    const source = await readText('base44/functions/sendSmsInvite/entry.ts');
    expect(source).toContain("code: 'INVITE_RELAY_DISABLED'");
    expect(source).toContain('Server-sent SMS invites are disabled. Use the share flow instead.');
    expect(source).toContain("console.error('sendSmsInvite error:', error)");
    expect(source).toContain("return Response.json({ error: 'Invite service unavailable' }, { status: 500 });");
    expect(source).not.toContain('api.twilio.com');
    expect(source).not.toContain('return Response.json({ error: error.message }');
  });
});
