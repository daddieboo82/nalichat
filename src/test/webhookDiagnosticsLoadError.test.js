import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('webhook diagnostics load state', () => {
  it('does not render failed subscription diagnostics as an empty account', async () => {
    const s = await readFile('src/pages/WebhookTest.jsx', 'utf8');
    expect(s).toContain('isError: subscriptionsError');
    expect(s).toContain("Couldn't load subscription diagnostics.");
    expect(s).toContain('onClick={() => void refetchSubscriptions()}');
  });

  it('points Stripe webhook setup instructions at the current NaliChat app', async () => {
    const source = await readFile('src/pages/WebhookTest.jsx', 'utf8');
    expect(source).toContain('/api/apps/6a1f5ee134147461560c2b37/functions/stripeWebhook');
    expect(source).not.toContain('/api/apps/cbef744a8545c389ef439ea6/functions/stripeWebhook');
  });

  it('labels external subscription IDs by their billing provider', async () => {
    const source = await readFile('src/pages/WebhookTest.jsx', 'utf8');
    expect(source).toContain("sub.provider === 'paypal' ? 'PayPal'");
    expect(source).toContain("sub.provider === 'stripe' ? 'Stripe'");
  });
});
