// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('public room creation idempotency', () => {
  it('uses deterministic room IDs and joins the canonical room after create races', async () => {
    const source = await readText('base44/functions/manageConversation/entry.ts');

    expect(source).toContain("hashedConversationId('public_room', name)");
    expect(source).toContain('const raced = await entities.Conversation.get(id)');
    expect(source).toContain('acquireConversationMembershipLock(entities, raced.id)');
    expect(source).toContain('duplicate: true');
    expect(source).toContain('name.length > 120');
    expect(source).toContain("typeof body?.name !== 'string'");
  });
});
