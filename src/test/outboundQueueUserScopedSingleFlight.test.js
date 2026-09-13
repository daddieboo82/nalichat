import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('outbound queue user-scoped single flight', () => {
  it('does not share one active flush promise across different signed-in users', async () => {
    const s = await readFile('src/lib/outboundQueue.js', 'utf8');
    expect(s).toContain('const activeFlushByUser = new Map()');
    expect(s).toContain('const rerunRequestedByUser = new Set()');
    expect(s).toContain('const flushScope = userId || "__all__"');
    expect(s).toContain('const existingFlush = activeFlushByUser.get(flushScope)');
    expect(s).toContain('activeFlushByUser.set(flushScope, operation)');
    expect(s).toContain('activeFlushByUser.delete(flushScope)');
    expect(s).not.toContain('let activeFlush = null');
  });
});
