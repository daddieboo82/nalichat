import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message download moderation gate', () => {
  it('blocks banned and timed-out users before service-role reads', async () => {
    const source = await readFile('base44/functions/authorizeMessageDownload/entry.ts', 'utf8');
    expect(source).toContain("if (user.is_banned)");
    expect(source).toContain("error: 'timed_out'");
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('consumeHourlyLimit('));
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('asServiceRole.entities.Message.get'));
  });
});
