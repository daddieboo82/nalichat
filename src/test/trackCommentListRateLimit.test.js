import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('public track comment list throttling', () => {
  it('rate-limits list reads before parent/comment service-role reads', async () => {
    const source = await readFile('base44/functions/trackComments/entry.ts', 'utf8');
    expect(source).toContain("'track_comment_list'");
    expect(source).toContain('track_comment_read_anon_');
    expect(source).toContain('track_comment_read_user_');
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(source.indexOf('canAccessParent(entities, user, parentType, parentId)'));
  });
});
