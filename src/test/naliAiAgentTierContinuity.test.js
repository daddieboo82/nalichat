// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolveNaliAgentTier } from '@/lib/naliAgentTier';

const choose = (overrides = {}) => resolveNaliAgentTier({ userId: 'userA', canUseBestModel: false, subscriptionLoading: false, subscriptionError: false, previous: null, ...overrides });

describe('NALI.ai verified agent-tier continuity', () => {
  it('keeps the same account Premium Plus conversation through loading and subscription error', () => {
    const plus = choose({ canUseBestModel: true });
    expect(plus.agentName).toBe('studio_ai_plus');
    expect(choose({ previous: plus, subscriptionLoading: true })).toBe(plus);
    expect(choose({ previous: plus, subscriptionError: true })).toBe(plus);
  });
  it('updates tier after real successful verification, including downgrade', () => {
    const plus = choose({ canUseBestModel: true });
    expect(choose({ previous: plus }).agentName).toBe('studio_ai');
    expect(choose({ previous: choose() , canUseBestModel: true }).agentName).toBe('studio_ai_plus');
  });
  it('never retains a previous account tier across user changes or logout', () => {
    const plus = choose({ canUseBestModel: true });
    expect(choose({ userId: 'userB', previous: plus, subscriptionError: true }).agentName).toBe('studio_ai');
    expect(choose({ userId: null, previous: plus, subscriptionError: true })).toEqual({ userId: null, agentName: 'studio_ai' });
  });
  it('uses verified tier for account-scoped keys while blocking dispatch on verification failure', async () => {
    const source = await readFile('src/components/AiAssistant.jsx', 'utf8');
    expect(source).toContain('resolveNaliAgentTier({');
    expect(source).toContain('const agentName = selectedAgent.agentName;');
    expect(source).toContain('if (subscriptionLoading || subscriptionError || !canUseAi) {');
    expect(source).toContain('const identityKey = user?.id ? `${user.id}:${agentName}` : null;');
  });
});
