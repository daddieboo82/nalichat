import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('call summary and reply identifier hardening', () => {
  it('rate-limits call summary requests before action dispatch', async () => {
    const source = await readFile('base44/functions/callSummarySession/entry.ts', 'utf8');
    expect(source).toContain("'call_summary_request'");
    expect(source).toContain("'RATE_LIMITED'");
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(source.indexOf('switch (body?.action)'));
  });

  it('rejects malformed call-summary entity ids before service-role lookup', async () => {
    const source = await readFile('base44/functions/callSummarySession/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(sessionId.trim())');
    expect(source).toContain('isConversationId(body.conversation_id.trim())');
  });

  it('validates reply_to_id before message lookup', async () => {
    const source = await readFile('base44/functions/sendConversationMessage/entry.ts', 'utf8');
    const valid = source.indexOf('isBase44EntityId(replyToId)');
    const lookup = source.indexOf('Message.get(replyToId)');
    expect(valid).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(valid);
  });
});
