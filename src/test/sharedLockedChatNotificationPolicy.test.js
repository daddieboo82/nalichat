// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('shared locked chat notification policy', () => {
  it('uses the shared server redaction helper and stores conversation ids', async () => {
    const workflow = await readText('base44/functions/notifyOnMessage/entry.ts');
    const schema = await readText('base44/entities/Notification.jsonc');

    expect(workflow).toContain("import { lockedNotification } from '../../shared/lockedChats.ts';");
    expect(workflow).toContain('...lockedNotification(conversation.id)');
    expect(workflow).toContain('conversation_id: conversation.id');
    expect(schema).toContain('"conversation_id"');
  });
});
