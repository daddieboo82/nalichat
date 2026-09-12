import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Safari auth bootstrap storage resilience', () => {
  it('wraps app-param storage access so denied localStorage cannot crash auth bootstrap', async () => {
    const source = await readFile('src/lib/app-params.js', 'utf8');
    expect(source).toContain('try { storage = windowObj.localStorage; } catch {}');
    expect(source).toContain('const safeStorageGet =');
    expect(source).toContain('const safeStorageSet =');
    expect(source).toContain('const safeStorageRemove =');
    expect(source).toContain('safeStorageGet(storageKey)');
    expect(source).toContain('safeStorageSet(storageKey, searchParam)');
    expect(source).toContain("safeStorageRemove('base44_access_token')");
    expect(source).not.toContain('const storage = windowObj.localStorage');
    expect(source).not.toContain('storage.getItem(storageKey)');
  });
});
