import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('folder mutation serialization', () => {
  it('provides a dedicated folder mutation lock entity/helper', async () => {
    const entity = await readFile('base44/entities/FolderMutationLock.jsonc', 'utf8');
    const helper = await readFile('base44/shared/folderMutationLock.ts', 'utf8');
    expect(entity).toContain('"name": "FolderMutationLock"');
    expect(helper).toContain('entities.FolderMutationLock.create');
    expect(helper).toContain('entities.FolderMutationLock.delete');
  });

  it('serializes folder deletion with file moves', async () => {
    const deletion = await readFile('base44/functions/deleteFolder/entry.ts', 'utf8');
    const mutation = await readFile('base44/functions/mutateSharedFile/entry.ts', 'utf8');
    expect(deletion).toContain('acquireFolderMutationLock(entities, folderId)');
    expect(deletion).toContain('releaseFolderMutationLock(entities, folderLockId)');
    expect(mutation).toContain('acquireFolderMutationLock(entities, requestedFolderId)');
    expect(mutation).toContain('releaseFolderMutationLock(entities, folderLockId)');
  });

  it('declares the move folder lock in finally-visible scope', async () => {
    const mutation = await readFile('base44/functions/mutateSharedFile/entry.ts', 'utf8');
    const declaration = mutation.indexOf('let folderLockId: string | null = null;');
    const innerTry = mutation.indexOf('try {', declaration);
    const release = mutation.indexOf('releaseFolderMutationLock(entities, folderLockId)');
    expect(declaration).toBeGreaterThan(-1);
    expect(innerTry).toBeGreaterThan(declaration);
    expect(release).toBeGreaterThan(innerTry);
  });
});
