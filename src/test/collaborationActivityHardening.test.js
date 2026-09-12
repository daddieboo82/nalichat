import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('collaboration activity hardening', () => {
  it('blocks restricted typing status updates before service-role reads', async () => {
    const source = await readFile('base44/functions/updateTypingStatus/entry.ts', 'utf8');
    expect(source).toContain("if (user.is_banned)");
    expect(source).toContain("error: 'timed_out'");
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('consumeHourlyLimit('));
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('entities.Conversation.get'));
  });

  it('moderation-gates and rate-limits collaboration actions before project reads', async () => {
    const source = await readFile('base44/functions/manageCollaboration/entry.ts', 'utf8');
    expect(source).toContain("if (user.is_banned)");
    expect(source).toContain("error: 'timed_out'");
    expect(source).toContain("'collaboration_session_action'");
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(source.indexOf('entities.Project.get'));
  });
});
