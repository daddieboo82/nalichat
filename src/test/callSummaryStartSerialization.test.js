// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('call summary start serialization', () => {
  it('serializes start requests and repairs missing consent rows before returning', async () => {
    const source = await readText('base44/functions/callSummarySession/entry.ts');
    const helper = await readText('base44/shared/callSummaryStartLock.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('acquireCallSummaryStartLock');
    expect(source).toContain('releaseCallSummaryStartLock');
    expect(source).toContain('CALL_SUMMARY_START_IN_PROGRESS');
    expect(source).toContain('ensureSessionConsents');
    expect(source).not.toContain('CallSummaryConsent.bulkCreate');

    expect(helper).toContain('CALL_SUMMARY_START_LOCK_TTL_MS = 5 * 60 * 1000');
    expect(helper).toContain('CallSummaryStartLock.create');
    expect(helper).toContain('CallSummaryStartLock.delete');
  });
});
