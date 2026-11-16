import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal activation requires provider-confirmed ACTIVE status', () => {
  it('cannot grant paid access based on a successful activation POST alone', async () => {
    const source = await readFile('base44/shared/paypalSubscription.ts', 'utf8');
    expect(source).toContain("if (fresh?.id === subscriptionId)");
    expect(source).toContain("if (freshStatus === 'ACTIVE')");
    expect(source).toContain("remoteStatus = 'ACTIVE'");
    expect(source).not.toContain("if (activated) remoteStatus = 'ACTIVE'");
    expect(source.indexOf("if (fresh?.id === subscriptionId)"))
      .toBeLessThan(source.indexOf("remoteStatus = 'ACTIVE'"));
  });
});
