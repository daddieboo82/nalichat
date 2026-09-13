import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('paginated message cache shape', () => {
  it('preserves {messages, hasOlder} during optimistic and chat-local cache updates', async () => {
    const page = await readFile('src/pages/Messages.jsx', 'utf8');
    const chat = await readFile('src/components/messages/ChatView.jsx', 'utf8');
    expect(page).toContain('function updateMessageHistory(cache, updater)');
    expect(page).toContain('messages: updater(Array.isArray(current.messages) ? current.messages : [])');
    expect(page).toContain('updateMessageHistory(old, (rows) => applyQueuedMessage(rows, tempMsg))');
    expect(page).toContain('updateMessageHistory(old, (rows) => applySendSuccess(rows, msg');
    expect(page).toContain('updateMessageHistory(old, (rows) => rows.map');
    expect(chat).toContain('function updateMessageHistory(cache, updater)');
    expect(chat).toContain('updateMessageHistory(current, (rows) =>');
    expect(chat).toContain('updateMessageHistory(old, (rows) => rows.filter');
  });
});
