import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Apple IAP subscription refresh', () => {
  it('invalidates the signed-in subscription query after backend purchase validation', async () => {
    const source = await readFile('src/hooks/useAppleIAP.js', 'utf8');
    const subscription = await readFile('src/hooks/useSubscription.js', 'utf8');
    expect(source).toContain('const { user } = useAuth()');
    expect(source).toContain('queryKey: subscriptionQueryKey(user?.id)');
    expect(source).toContain('}, [queryClient, user?.id])');
    expect(source).not.toContain('queryKey: subscriptionQueryKey()');
    expect(subscription).toContain('queryKey: subscriptionQueryKey(user?.id)');
  });
});
