import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('external email relationship authorization', () => {
  it('requires mutual contacts before sending email', async () => {
    const s = await readFile('base44/functions/sendExternalMessage/entry.ts', 'utf8');
    expect(s).toContain('{ user_id: user.id, contact_user_id: registeredUser.id }');
    expect(s).toContain('{ user_id: registeredUser.id, contact_user_id: user.id }');
    expect(s).toContain('outboundContacts.length === 0 || inboundContacts.length === 0');
    expect(s).toContain("return Response.json({ success: true, method: 'email' });");
  });
});
