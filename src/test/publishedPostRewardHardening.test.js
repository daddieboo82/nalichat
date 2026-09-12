import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('published post reward hardening', () => {
  it('validates IDs and rate-limits before post/reward service-role work', async () => {
    const source = await readFile('base44/functions/claimPublishedPostReward/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(postId)');
    expect(source).toContain("'published_post_reward_claim'");
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(source.indexOf('entities.ArtPost.get(postId)'));
    expect(source.indexOf('isBase44EntityId(postId)')).toBeLessThan(source.indexOf('consumeHourlyLimit('));
  });
});
