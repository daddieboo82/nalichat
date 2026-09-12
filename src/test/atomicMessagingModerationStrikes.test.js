// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('atomic messaging moderation strikes', () => {
  it('increments violation counts atomically before enforcement decisions', async () => {
    const helper = await readText('base44/shared/moderationStrikes.ts');
    const send = await readText('base44/functions/sendConversationMessage/entry.ts');
    const mutate = await readText('base44/functions/mutateConversationMessage/entry.ts');

    expect(helper).toContain('{ $inc: { violation_count: 1 } }');
    expect(helper).toContain('Number(result?.updated || 0) !== 1');
    expect(helper).toContain('entities.User.get(userId)');

    for (const source of [send, mutate]) {
      expect(source).toContain('claimModerationStrike');
      expect(source).toContain('const newCount = strike.violationCount');
      expect(source).toContain('violation_count: newCount');
      expect(source).not.toMatch(/User\.update\([\s\S]*violation_count:\s*newCount/);
    }
  });
});
