import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('one-time checkout error sanitization', () => {
  it('returns only allowlisted client validation messages and a generic 500', async () => {
    const source = await readFile('base44/functions/createCheckout/entry.ts', 'utf8');
    const helper = await readFile('base44/shared/checkoutHelpers.ts', 'utf8');
    expect(source).toContain("checkoutErrorMessage as errorMessage");
    expect(source).toContain("isCheckoutClientError as isClientError");
    expect(helper).toContain("message === 'Invalid checkout callback URL'");
    expect(helper).toContain("message === 'Checkout callback URL is not allowed'");
    expect(source).toContain("'Unable to create checkout session'");
    expect(source).not.toContain("{ error: message },\n      { status: 500 }");
  });
});
