import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('public shared-file abuse protection', () => {
  it('rate limits anonymous token lookups before service-role file reads', async () => {
    const source = await readFile('base44/functions/getSharedFileByToken/entry.ts', 'utf8');
    expect(source).toContain("import { consumeHourlyLimit } from '../../shared/rateLimit.ts';");
    expect(source).toContain("'shared_file_token_read'");
    expect(source).toContain("'Too many share-link attempts. Please try again later.'");
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(
      source.indexOf('SharedFile.get(normalizedFileId)'),
    );
  });
});
