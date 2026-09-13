// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('user collection lookup bounds', () => {
  it('caps liked-post and public-achievement reads', async () => {
    const likes = await readText('base44/functions/listMyLikedPostIds/entry.ts');
    const achievements = await readText('base44/functions/listPublicAchievements/entry.ts');

    expect(likes).toMatch(/ArtPost\.filter\([\s\S]*liked_by: user\.id[\s\S]*'-created_date',[\s\S]*1000/);
    expect(achievements).toMatch(/Achievement\.filter\([\s\S]*user_id: target\.id[\s\S]*'-created_date',[\s\S]*500/);
  });

  it('paginates billing ownership history while keeping exact purchase verification bounded', async () => {
    const portal = await readText('base44/functions/createBillingPortal/entry.ts');
    const verification = await readText('base44/functions/verifyCheckoutPayment/entry.ts');

    expect(portal).toContain('async function loadStripeSubscriptions(entity: any, userId: string)');
    expect(portal).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(portal).not.toContain("'-created_date',\n      100,");
    expect(verification).toMatch(/Base44Purchase\.filter\([\s\S]*checkoutSessionId: normalizedCheckoutId[\s\S]*'-created_date',[\s\S]*2/);
    expect(verification).toContain('purchases.length !== 1');
  });
});
