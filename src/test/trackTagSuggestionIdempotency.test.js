// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('track tag suggestion idempotency', () => {
  it('serializes the AI suggestion job per track', async () => {
    const source = await readText('base44/functions/suggestTrackTags/entry.ts');

    expect(source).toContain('acquireTrackLifecycleLock');
    expect(source).toContain('releaseTrackLifecycleLock');
    expect(source).toContain('Track metadata is being updated. Please retry.');
    expect(source).toContain('trackId.length > 200');
    expect(source.indexOf('acquireTrackLifecycleLock')).toBeLessThan(
      source.indexOf('already_suggested'),
    );
    expect(source.indexOf('already_suggested')).toBeLessThan(
      source.indexOf('InvokeLLM'),
    );
  });
});
