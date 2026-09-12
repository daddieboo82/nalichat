import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('presence, theme, and reminder error sanitization', () => {
  it('does not expose raw presence exceptions', async () => {
    const source = await readFile('base44/functions/updateUserPresence/entry.ts', 'utf8');
    expect(source).toContain("{ error: 'Unable to update presence' }");
    expect(source).not.toContain("error instanceof Error ? error.message : 'Unable to update presence'");
  });

  it('does not expose raw chat-theme exceptions', async () => {
    const source = await readFile('base44/functions/setChatTheme/entry.ts', 'utf8');
    expect(source).toContain("{ error: 'Unable to save chat theme.' }");
    expect(source).not.toContain("error instanceof Error ? error.message : 'Unable to save chat theme.'");
  });

  it('keeps typed reminder errors but sanitizes unexpected failures', async () => {
    const source = await readFile('base44/shared/followUpReminders.ts', 'utf8');
    expect(source).toContain('error instanceof FollowUpReminderError');
    expect(source).toContain("{ error: 'Unable to process follow-up reminder.' }");
    expect(source).not.toContain("const message = error instanceof Error ? error.message");
  });
});
