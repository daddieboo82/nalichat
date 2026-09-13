import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('voice card branding and media playback', () => {
  it('uses the production domain and surfaces playback failures', async () => {
    const voice = await readFile('src/components/messages/VoiceCardDialog.jsx', 'utf8');
    const media = await readFile('src/components/explore/MediaViewerModal.jsx', 'utf8');
    expect(voice).toContain('const APP_URL = "nalichat.org";');
    expect(voice).not.toContain('nalichat.base44.app');
    expect(media).toContain("Couldn't play this track. Please try again.");
    expect(media).toContain('setIsPlaying(false);');
  });
});
