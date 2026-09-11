// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('subscription checkout moderation gates', () => {
  it('blocks banned and timed-out users before checkout side effects', async () => {
    const source = await readText('base44/functions/createSubscriptionCheckout/entry.ts');

    expect(source).toContain('user.is_banned');
    expect(source).toContain('user.timeout_until');
    expect(source).toContain("error: 'timed_out'");
    expect(source.indexOf('user.is_banned')).toBeLessThan(
      source.indexOf('consumeHourlyLimit'),
    );
    expect(source.indexOf('user.timeout_until')).toBeLessThan(
      source.indexOf("stripe_checkout_claim_id"),
    );
    expect(source.indexOf('user.timeout_until')).toBeLessThan(
      source.indexOf("stripeRequest("),
    );
  });
});
