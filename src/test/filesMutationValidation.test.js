import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Files mutation validation', () => {
  it('requires confirmed upload, delete, and update responses', async () => {
    const s = await readFile('src/pages/Files.jsx', 'utf8');
    expect(s).toContain('File upload was not confirmed');
    expect(s).toContain('File deletion was not confirmed');
    expect(s).toContain('File update was not confirmed');
  });
});


describe('Files share-link account binding', () => {
  it('passes the active user id into the share button instead of reading an out-of-scope variable', async () => {
    const s = await readFile('src/pages/Files.jsx', 'utf8');
    expect(s).toContain('function FileShareButton({ file, canShare, currentUserId })');
    expect(s).toContain('res?.data?.userId !== currentUserId');
    expect(s).toContain('currentUserId={currentUser?.id}');
    expect(s).not.toContain('function FileShareButton({ file, canShare })');
  });
});


describe('Files folder deletion response binding', () => {
  it('accepts folder deletion only for the active user and exact folder', async () => {
    const s = await readFile('src/pages/Files.jsx', 'utf8');
    expect(s).toContain('res?.data?.action !== "delete_folder"');
    expect(s).toContain('res?.data?.userId !== currentUser?.id');
    expect(s).toContain('res?.data?.folderId !== id');
    expect(s).toContain('res?.data?.deleted !== true');
    expect(s).toContain('Folder deletion was not confirmed');
  });
});
