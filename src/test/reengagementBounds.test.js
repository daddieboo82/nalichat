// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('reengagement candidate bounds', () => {
  it('targets only stalled users and caps each maintenance run', async () => {
    const source = await readText('base44/functions/reengageStalledUsers/entry.ts');

    expect(source).toContain('MAX_REENGAGEMENTS_PER_RUN = 500');
    expect(source).toMatch(/User\.filter\([\s\S]*onboarding_completed: false[\s\S]*reengagement_sent_at: null[\s\S]*created_date: \{ \$lt: oneDayAgo \}[\s\S]*MAX_REENGAGEMENTS_PER_RUN/);
    expect(source).not.toContain('User.list()');
  });
});
