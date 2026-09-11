// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('track comment serialization', () => {
  it('serializes track comment creation with track lifecycle mutations', async () => {
    const source = await readText('base44/functions/trackComments/entry.ts');

    expect(source).toContain('acquireTrackLifecycleLock');
    expect(source).toContain('releaseTrackLifecycleLock');
    expect(source).toContain("action === 'create' && parentType === 'track'");
    expect(source).toContain('Track is being updated. Please retry.');
    expect(source).toContain('status: 409');
  });
});
