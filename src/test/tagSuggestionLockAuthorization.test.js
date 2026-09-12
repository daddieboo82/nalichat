import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('track tag suggestion lock authorization', () => {
  it('authorizes before lifecycle lock and rechecks inside the lock', async () => {
    const source = await readFile('base44/functions/suggestTrackTags/entry.ts', 'utf8');
    expect(source).toContain('trackPreview');
    expect(source).toContain('authorizeTrackRequest');
    expect(source).toContain('previewAuthError');
    expect(source).toContain('lockedAuthError');
    expect(source.indexOf('previewAuthError')).toBeLessThan(source.indexOf('acquireTrackLifecycleLock(entities, trackId)'));
  });
});
