// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('SMS provider error exposure', () => {
  it('keeps Twilio/provider details server-side', async () => {
    const source = await readText('base44/functions/sendSmsInvite/entry.ts');
    expect(source).toContain("console.error('Twilio error:', data)");
    expect(source).toContain("return Response.json({ error: 'Failed to send SMS' }, { status: 502 });");
    expect(source).toContain("return Response.json({ error: 'Failed to send SMS' }, { status: 500 });");
    expect(source).not.toContain("return Response.json({ error: data.message || 'Failed to send SMS' }");
    expect(source).not.toContain('return Response.json({ error: error.message }');
  });
});
