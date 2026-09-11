// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('account deletion batch bounds', () => {
  it('batches private records, inbound contacts, moderation, and upload cleanup', async () => {
    const source = await readFile(
      new URL('../../base44/functions/deleteMyAccount/entry.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain('const CLEANUP_BATCH_SIZE = 200;');
    expect(source).toContain("entity.filter(query, '-created_date', CLEANUP_BATCH_SIZE)");
    expect(source).toContain('{ [ownerField]: user.id }');
    expect(source).toContain('{ contact_user_id: user.id }');
    expect(source).toContain('{ user_id: user.id }');
    expect(source).toContain('{ reported_by_id: user.id }');
    expect(source).toContain('{ uploader_id: user.id }');
    expect(source).toContain('share_token_expires_at: null');
  });
});
