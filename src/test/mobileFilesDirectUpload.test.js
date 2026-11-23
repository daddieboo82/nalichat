import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Files mobile direct upload', () => {
  it('opens the native picker directly on phones while retaining the desktop upload dialog', async () => {
    const source = await readFile('src/pages/Files.jsx', 'utf8');
    expect(source).toContain('aria-label="Choose files to upload"');
    expect(source).toContain('className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={handleUpload}');
    expect(source).toContain('sm:hidden');
    expect(source).toContain('sm:inline-flex" onClick={() => setShowUploadModal(true)}');
    expect(source).toContain('data-testid="files-upload-input"');
  });
  it('preserves Nali Transfer deep links and direct navigation', async () => {
    const source = await readFile('src/pages/Files.jsx', 'utf8');
    expect(source).toContain('get("view") === "transfer"');
    expect(source).toContain('setShowTransfer(true)');
    expect(source).toContain('>Nali Transfer</Button>');
    expect(source).toContain('<LargeFileTransfer currentUser={currentUser} />');
  });
});