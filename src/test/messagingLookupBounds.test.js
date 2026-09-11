// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('messaging lookup bounds', () => {
  it('routes global DM discovery through the bounded server endpoint', async () => {
    const dialog = await readText('src/components/GlobalMessageDialog.jsx');
    expect(dialog).not.toContain('Conversation.filter({})');
    expect(dialog).toContain('action: "create_dm"');
  });

  it('caps typing-status duplicate reconciliation', async () => {
    const typing = await readText('base44/functions/updateTypingStatus/entry.ts');
    expect(typing).toMatch(/TypingStatus\.filter\([\s\S]*'-last_typed_at',[\s\S]*20/);
  });
});
