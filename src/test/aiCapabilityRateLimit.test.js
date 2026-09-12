import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('AI capability lookup throttling', () => {
  it('rate-limits before capability resolution', async () => {
    const source = await readFile('base44/functions/getAiCapabilities/entry.ts', 'utf8');
    expect(source).toContain("'ai_capability_read'");
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(source.indexOf('describeAiCapabilities({'));
  });
});
