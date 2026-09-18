// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('conversation creation rate accounting', () => {
  it('does not charge creation quota for existing DMs or public rooms', async () => {
    const source = await readText('base44/functions/manageConversation/entry.ts');

    const dmExisting = source.indexOf("return Response.json({ success: true, action: 'create_dm'");
    const dmRate = source.indexOf("consumeHourlyLimit(entities, user.id, 'conversation_create', 60)", dmExisting);
    expect(dmExisting).toBeGreaterThan(-1);
    expect(dmRate).toBeGreaterThan(dmExisting);

    const publicExisting = source.indexOf('if (existing.length > 0) {');
    const publicCreateRate = source.lastIndexOf("consumeHourlyLimit(entities, user.id, 'conversation_create', 60)");
    expect(publicCreateRate).toBeGreaterThan(publicExisting);
  });
});
