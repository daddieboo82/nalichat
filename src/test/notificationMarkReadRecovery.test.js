// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('notification mark-read recovery', () => {
  it('contains partial update failures and refreshes state', async () => {
    const source = await readText('src/components/notifications/NotificationBell.jsx');

    expect(source).toContain('Promise.allSettled(');
    expect(source).toContain('results.some((result) => result.status === "rejected")');
    expect(source).toContain("Some notifications weren't marked read");
    expect(source).toContain('void markAllRead();');
  });
});
