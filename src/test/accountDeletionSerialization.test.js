// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('account deletion serialization', () => {
  it('allows only one destructive deletion pass per account', async () => {
    const source = await readText('base44/functions/deleteMyAccount/entry.ts');
    const helper = await readText('base44/shared/accountDeletionLock.ts');
    const schema = JSON.parse(await readText('base44/entities/AccountDeletionLock.jsonc'));

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('acquireAccountDeletionLock');
    expect(source).toContain('releaseAccountDeletionLock');
    expect(source).toContain('Account deletion is already in progress.');
    expect(source).toContain('status: 409');

    expect(helper).toContain('ACCOUNT_DELETION_LOCK_TTL_MS = 30 * 60 * 1000');
    expect(helper).toContain('AccountDeletionLock.create');
    expect(helper).toContain('AccountDeletionLock.delete');
    expect(schema.rls.read?.user_condition?.role).toBe('admin');
  });
});
