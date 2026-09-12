// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('seed group chat welcome method guard', () => {
  it('rejects non-POST requests before auth/service-role work', async () => {
    const source = await readFile('base44/functions/seedGroupChatWelcome/entry.ts', 'utf8');
    const methodGuard = source.indexOf("if (req.method !== 'POST')");
    const authCheck = source.indexOf('const base44 = createClientFromRequest(req)');
    expect(methodGuard).toBeGreaterThanOrEqual(0);
    expect(methodGuard).toBeLessThan(authCheck);
    expect(source).toContain("status: 405");
  });
});
