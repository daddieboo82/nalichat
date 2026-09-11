// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('message idempotency lookup bounds', () => {
  it('limits canonical message and moderation replay lookups to one earliest record', async () => {
    const source = await readText('base44/functions/sendConversationMessage/entry.ts');

    expect(source).toMatch(/Message\.filter\([\s\S]*client_message_key: clientMessageKey[\s\S]*'created_date',[\s\S]*1/);
    expect(source).toMatch(/Violation\.filter\([\s\S]*client_message_key: clientMessageKey[\s\S]*'created_date',[\s\S]*1/);
    expect(source).not.toContain('return [...matches].sort');
  });
});
