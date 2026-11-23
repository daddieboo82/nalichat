// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai subscription verification is distinct from a free account', () => {
  it('blocks dispatch during a verification error without falsely telling users their plan ended', async () => {
    const source = await read();
    expect(source).toContain('isError: subscriptionError');
    expect(source).toContain('if (subscriptionLoading || subscriptionError || !canUseAi) {');
    expect(source).toContain('if (subscriptionError) throw new Error("Subscription verification unavailable");');
    expect(source).toContain('Your subscription may still be active.');
  });
  it('provides an accessible in-panel retry that only rechecks subscription status', async () => {
    const source = await read();
    expect(source).toContain('refetch: refetchSubscription');
    expect(source).toContain('onClick={() => void refetchSubscription()}');
    expect(source).toContain('Check access again');
    expect(source).toContain('{subscriptionError && (\n                <div role="alert"');
  });
  it('keeps contextual opening and messaging gated during an error', async () => {
    const source = await read();
    expect(source).toContain('subscriptionLoading, subscriptionError, agentName');
    expect(source).toContain('if (subscriptionError) {\n      toast.error("Couldn\'t verify your Premium access. Try checking your subscription again.");');
    expect(source).toContain('setSendError(friendlyNaliError(err));');
  });
});
