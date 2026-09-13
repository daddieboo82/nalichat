// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('message edit preview correctness', () => {
  it('updates the conversation preview only when the edited message is latest', async () => {
    const source = await readText('base44/functions/mutateConversationMessage/entry.ts');

    expect(source).toContain('async function findLatestNonSessionMessage');
    expect(source).toContain("page.find((candidate: any) => candidate.type !== 'session')");
    expect(source).toContain('if (latest?.id === message.id)');
    expect(source).toContain('last_message_at: latest.created_date || null');
    expect(source).not.toContain('conversation?.last_message_text === message.text');
  });
});
