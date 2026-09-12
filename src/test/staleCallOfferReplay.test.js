// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('stale call offer replay protection', () => {
  it('only surfaces recent incoming call offers from stored message history', async () => {
    const source = await readFile('src/hooks/useCall.js', 'utf8');
    expect(source).toContain('const INCOMING_OFFER_MAX_AGE_MS = RING_TIMEOUT_MS + 15000;');
    expect(source).toContain('const createdAt = Date.parse(msg.created_date || "");');
    expect(source).toContain('Date.now() - createdAt <= INCOMING_OFFER_MAX_AGE_MS');
    expect(source).toContain('if (!offerIsFresh) continue;');
  });
});
