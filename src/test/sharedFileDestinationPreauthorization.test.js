import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('shared file destination preauthorization', () => {
  it('validates and authorizes project/folder before remote storage size probing', async () => {
    const s = await readFile('base44/functions/createSharedFileRecord/entry.ts', 'utf8');
    const folderAuth = s.indexOf('const folderPreview = await entities.Folder.get(previewFolderId)');
    const projectAuth = s.indexOf('const projectPreview = await entities.Project.get(previewProjectId)');
    const probe = s.indexOf('const storedFileSize = await resolveStoredFileSize(fileUrl)');
    expect(folderAuth).toBeGreaterThan(-1);
    expect(projectAuth).toBeGreaterThan(-1);
    expect(probe).toBeGreaterThan(folderAuth);
    expect(probe).toBeGreaterThan(projectAuth);
  });

  it('validates file type before remote probing', async () => {
    const s = await readFile('base44/functions/createSharedFileRecord/entry.ts', 'utf8');
    const typeCheck = s.indexOf('if (!FILE_TYPES.has(requestedFileType))');
    const probe = s.indexOf('const storedFileSize = await resolveStoredFileSize(fileUrl)');
    expect(typeCheck).toBeGreaterThan(-1);
    expect(probe).toBeGreaterThan(typeCheck);
  });
});
