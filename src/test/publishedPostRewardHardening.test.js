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


describe('published post reward response identity contract', () => {
  it('binds reward confirmation to the authenticated creator and exact post', async () => {
    const backend = await readFile('base44/functions/claimPublishedPostReward/entry.ts', 'utf8');
    const bounce = await readFile('src/components/studio/BounceDialog.jsx', 'utf8');
    const upload = await readFile('src/components/explore/UploadArtDialog.jsx', 'utf8');
    expect(backend).toContain("action: 'claim_publish_reward'");
    expect(backend).toContain('userId: user.id');
    expect(backend).toContain('postId: post.id');
    expect(bounce).toContain('reward?.data?.userId !== user?.id');
    expect(bounce).toContain('reward?.data?.postId !== postId');
    expect(upload).toContain('reward?.data?.userId !== publishingUserId');
    expect(upload).toContain('reward?.data?.postId !== createdPost.id');
  });
});
