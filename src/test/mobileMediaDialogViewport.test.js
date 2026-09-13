// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('mobile media dialog viewport safety', () => {
  it('uses dynamic viewport heights for Explore media and upload dialogs', async () => {
    const viewer = await readFile('src/components/explore/MediaViewerModal.jsx', 'utf8');
    const upload = await readFile('src/components/explore/UploadArtDialog.jsx', 'utf8');
    expect(viewer).toContain('max-h-[90dvh]');
    expect(viewer).toContain('[-webkit-overflow-scrolling:touch]');
    expect(upload).toContain('max-h-[90dvh]');
  });

  it('uses dynamic viewport limits for message media previews', async () => {
    const media = await readFile('src/components/messages/MediaViewer.jsx', 'utf8');
    expect(media).toContain('max-h-[90dvh]');
    expect(media).toContain('max-h-[60dvh]');
    expect(media).toContain('max-h-[70dvh]');
  });
});
