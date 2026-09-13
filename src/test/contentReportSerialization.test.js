import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('content report serialization', () => {
  it('preauthorizes before locking and rechecks under the lock', async () => {
    const s = await readFile('base44/functions/reportContent/entry.ts', 'utf8');

    const messagePreview = s.indexOf('const preview = await entities.Message.get(normalizedContentId)');
    const messageLock = s.indexOf('messageLockId = await acquireMessageMutationLock');
    const messageRecheck = s.indexOf('const message = await entities.Message.get(normalizedContentId)', messageLock);

    expect(messagePreview).toBeGreaterThan(-1);
    expect(messageLock).toBeGreaterThan(messagePreview);
    expect(messageRecheck).toBeGreaterThan(messageLock);

    const postPreview = s.indexOf('const preview = await entities.ArtPost.get(normalizedContentId)');
    const postLock = s.indexOf('artPostLockId = await acquireArtPostEngagementLock');
    const postRecheck = s.indexOf('const post = await entities.ArtPost.get(normalizedContentId)', postLock);

    expect(postPreview).toBeGreaterThan(-1);
    expect(postLock).toBeGreaterThan(postPreview);
    expect(postRecheck).toBeGreaterThan(postLock);
  });

  it('checks for a pending duplicate only after acquiring the content lock', async () => {
    const s = await readFile('base44/functions/reportContent/entry.ts', 'utf8');
    const messageLock = s.indexOf('messageLockId = await acquireMessageMutationLock');
    const postLock = s.indexOf('artPostLockId = await acquireArtPostEngagementLock');
    const duplicateCheck = s.indexOf('const existing = await entities.Violation.filter');
    const create = s.indexOf('await entities.Violation.create({');

    expect(messageLock).toBeGreaterThan(-1);
    expect(postLock).toBeGreaterThan(-1);
    expect(duplicateCheck).toBeGreaterThan(messageLock);
    expect(duplicateCheck).toBeGreaterThan(postLock);
    expect(create).toBeGreaterThan(duplicateCheck);
    expect(s).toContain('releaseMessageMutationLock(entities, messageLockId)');
    expect(s).toContain('releaseArtPostEngagementLock(entities, artPostLockId)');
  });
});
