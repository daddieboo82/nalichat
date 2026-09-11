// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('follow-up reminder query bounds', () => {
  it('loads only due reminders and only messages newer than the source message', async () => {
    const source = await readText('base44/shared/followUpReminders.ts');

    expect(source).toContain("remind_at: { $lte: clock.toISOString() }");
    expect(source).toContain("created_date: { $gt: reminder.source_message_created_at }");
    expect(source).toContain("const pageSize = 200");
    expect(source).toContain("if (match) return match");
    expect(source).not.toContain("const messages = await loadAll(messageEntity, {\n    conversation_id: reminder.conversation_id");
  });
});
