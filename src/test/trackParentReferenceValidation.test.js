import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('track parent reference validation', () => {
  it('validates the stored parent before preview authorization reads', async () => {
    const s = await readFile('base44/functions/mutateTrack/entry.ts', 'utf8');
    const check = s.indexOf('isBase44EntityId(trackPreview.project_id)');
    const projectRead = s.indexOf('Project.get(trackPreview.project_id)');
    const messageRead = s.indexOf('Message.get(trackPreview.project_id)');
    expect(check).toBeGreaterThan(-1);
    expect(projectRead).toBeGreaterThan(check);
    expect(messageRead).toBeGreaterThan(check);
  });
  it('rechecks the parent under the track lifecycle lock', async () => {
    const s = await readFile('base44/functions/mutateTrack/entry.ts', 'utf8');
    const lock = s.indexOf('const lockId = await acquireTrackLifecycleLock');
    expect(s.indexOf('Track parent changed. Please retry.', lock)).toBeGreaterThan(lock);
  });
});
