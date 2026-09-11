// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Messages query error states', () => {
  it('distinguishes query failures from empty data', async () => {
    const page = await readText('src/pages/Messages.jsx');
    const chat = await readText('src/components/messages/ChatView.jsx');

    expect(page).toContain('isError: conversationsError');
    expect(page).toContain('isError: messagesError');
    expect(page).toContain("Couldn't load conversations. Pull to refresh or try again.");
    expect(page).toContain('loadError={messagesError}');
    expect(chat).toContain('loadError ? (');
    expect(chat).toContain("Couldn't load messages. Please try again.");
  });
});
