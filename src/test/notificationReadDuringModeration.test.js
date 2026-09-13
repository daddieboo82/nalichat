import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('notification read state during moderation', () => {
  it('allows any authenticated user to mark their own notifications read', async () => {
    const s = await readFile('base44/functions/markNotificationsRead/entry.ts', 'utf8');
    expect(s).toContain('const user = await base44.auth.me()');
    expect(s).toContain('{ recipient_id: user.id }');
    expect(s).not.toContain('user.is_banned');
    expect(s).not.toContain('timeout_until');
  });
});
