// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('download authorization media validation', () => {
  it('requires a non-empty authorized URL and filename for message media', async () => {
    const source = await readFile('src/components/messages/MediaViewer.jsx', 'utf8');
    expect(source).toContain('typeof downloadUrl !== "string"');
    expect(source).toContain('!downloadUrl.trim()');
    expect(source).toContain('typeof downloadName !== "string"');
    expect(source).toContain('!downloadName.trim()');
  });

  it('requires a non-empty authorized URL and title for Explore downloads', async () => {
    const source = await readFile('src/components/explore/MediaViewerModal.jsx', 'utf8');
    expect(source).toContain('typeof downloadUrl !== "string"');
    expect(source).toContain('!downloadUrl.trim()');
    expect(source).toContain('typeof authorizedTitle !== "string"');
    expect(source).toContain('!authorizedTitle.trim()');
    expect(source).toContain('let fileName = authorizedTitle;');
  });
});
