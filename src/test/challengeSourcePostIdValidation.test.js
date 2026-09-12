import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge source post id validation', () => {
  it('validates source_post_id before ArtPost lookup', async () => {
    const s=await readFile('base44/functions/submitChallengeRemix/entry.ts','utf8');
    const check=s.indexOf('isBase44EntityId(sourcePostId)');
    const lookup=s.indexOf('ArtPost.get(sourcePostId)');
    expect(check).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(check);
  });
});
