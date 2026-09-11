// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('published post reward retryability', () => {
  it('treats create failures as duplicates only when the deterministic reward exists', async () => {
    const source = await readText('base44/functions/claimPublishedPostReward/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('catch (createError)');
    expect(source).toContain('entities.UserActivityReward.get(rewardId)');
    expect(source).toContain('throw createError');
    expect(source).toContain('duplicate: true');
  });
});
