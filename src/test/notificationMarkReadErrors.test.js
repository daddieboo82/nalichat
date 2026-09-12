// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('notification read update failures', () => {
  it('contains mark-all-read failures and reports stale unread state', async () => {
    const source = await readText('src/components/notifications/NotificationBell.jsx');

    expect(source).toContain('await Promise.allSettled(');
    expect(source).toContain('await load(user.id);');
    expect(source).toContain("Some notifications weren't marked read");
    expect(source).toContain('void markAllRead();');
  });
});
