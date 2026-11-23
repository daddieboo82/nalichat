// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { isUncertainAiDelivery } from '@/lib/naliDeliveryStatus';

describe('NALI.ai uncertain delivery safety', () => {
  it('treats lost responses and server/gateway failures as ambiguous after dispatch', () => {
    expect(isUncertainAiDelivery(new TypeError('Failed to fetch'))).toBe(true);
    expect(isUncertainAiDelivery({ response: { status: 504 } })).toBe(true);
    expect(isUncertainAiDelivery({ response: { status: 500, data: { error: 'Unable to send assistant message.' } } })).toBe(true);
    expect(isUncertainAiDelivery({ code: 'AI_REQUEST_ALREADY_DISPATCHED' })).toBe(true);
    expect(isUncertainAiDelivery({ response: { data: { code: 'AI_REQUEST_IN_PROGRESS' } } })).toBe(true);
  });
  it('distinguishes clearly rejected validation, entitlement and quota requests', () => {
    expect(isUncertainAiDelivery({ code: 'AI_DAILY_QUOTA_EXHAUSTED' })).toBe(false);
    expect(isUncertainAiDelivery({ response: { status: 403, data: { code: 'AI_NOT_ENTITLED' } } })).toBe(false);
    expect(isUncertainAiDelivery({ response: { status: 413 } })).toBe(false);
    expect(isUncertainAiDelivery({ response: { status: 400 } })).toBe(false);
    expect(isUncertainAiDelivery({ response: { status: 429 } })).toBe(false);
    expect(isUncertainAiDelivery({ status: 429 })).toBe(false);
    expect(isUncertainAiDelivery({ response: { status: 408 } })).toBe(true);
  });
  it('keeps uncertain requests pending only once dispatch has begun', async () => {
    const source = await readFile('src/components/AiAssistant.jsx', 'utf8');
    expect(source).toContain('let dispatchStarted = false;');
    expect(source).toContain('dispatchStarted = true;');
    expect(source).toContain('error.status = response.status || response.data.status;');
    expect(source).toContain('if (dispatchStarted && isUncertainAiDelivery(err)) {');
    expect(source).toContain('void refreshPendingReply({ quiet: true });');
    expect(source).toContain('if (!preserveDraft) setInput(current => current || text);');
  });
});
