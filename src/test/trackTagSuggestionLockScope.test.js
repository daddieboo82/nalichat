import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('track tag suggestion lock scope', () => {
  it('runs the LLM before acquiring the lifecycle lock', async () => {
    const source = await readFile('base44/functions/suggestTrackTags/entry.ts', 'utf8');
    const llm = source.indexOf('integrations.Core.InvokeLLM');
    const lock = source.indexOf('const lockId = await acquireTrackLifecycleLock(entities, trackId)');
    expect(llm).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(llm);
  });

  it('rechecks authorization and idempotency inside the lock before writes', async () => {
    const source = await readFile('base44/functions/suggestTrackTags/entry.ts', 'utf8');
    const lock = source.indexOf('const lockId = await acquireTrackLifecycleLock(entities, trackId)');
    const auth = source.indexOf('const lockedAuthError = await authorizeTrackRequest(track)', lock);
    const already = source.indexOf('track.suggested_genre && track.suggested_bpm', lock);
    const update = source.indexOf('entities.Track.update(trackId', lock);
    expect(auth).toBeGreaterThan(lock);
    expect(already).toBeGreaterThan(auth);
    expect(update).toBeGreaterThan(already);
  });
});
