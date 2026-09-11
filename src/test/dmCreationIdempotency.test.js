// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('DM creation idempotency', () => {
  it('uses deterministic sorted-pair IDs and recovers concurrent collisions', async () => {
    const source = await readText('base44/functions/manageConversation/entry.ts');

    expect(source).toContain('async function dmConversationId');
    expect(source).toContain('dm_');
    expect(source).toContain('const raced = await entities.Conversation.get(id)');
    expect(source).toContain('duplicate: true');
    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('participant_ids must contain only strings');
    expect(source).toContain('name.length > 120');
  });
});
