// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('new chat contact loading errors', () => {
  it('distinguishes contact load failures from an empty contact list', async () => {
    const source = await readText('src/components/messages/NewChatDialog.jsx');

    expect(source).toContain('isError: contactsError');
    expect(source).toContain("Couldn't load your contacts. You can still search all available users below.");
    expect(source).toContain('role="alert"');
  });
});
