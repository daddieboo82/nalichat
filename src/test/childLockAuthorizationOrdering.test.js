import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('child resource lock authorization ordering', () => {
  it('authorizes milestone creation before project lock', async () => {
    const source = await readFile('base44/functions/createProjectMilestone/entry.ts', 'utf8');
    expect(source.indexOf('projectPreview')).toBeLessThan(source.indexOf('acquireProjectMembershipLock('));
  });

  it('authorizes folder creation before project lock', async () => {
    const source = await readFile('base44/functions/createProjectFolder/entry.ts', 'utf8');
    expect(source.indexOf('projectPreview')).toBeLessThan(source.indexOf('acquireProjectMembershipLock('));
  });

  it('rate-limits and authorizes track version creation before track lock', async () => {
    const source = await readFile('base44/functions/createTrackVersion/entry.ts', 'utf8');
    const lock = source.indexOf('acquireTrackLifecycleLock(entities, trackId)');
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(lock);
    expect(source.indexOf('projectPreview')).toBeLessThan(lock);
    expect(source.indexOf('trackPreview')).toBeLessThan(lock);
  });
});
