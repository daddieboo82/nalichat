// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('mobile Studio viewport scrolling', () => {
  it('uses the dynamic viewport for Studio shell states', async () => {
    const studio = await readFile('src/pages/Studio.jsx', 'utf8');
    const welcome = await readFile('src/components/studio/StudioWelcome.jsx', 'utf8');
    expect((studio.match(/h-screen h-\[100dvh\]/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(welcome).toContain('h-screen h-[100dvh]');
  });

  it('uses dynamic viewport limits and native touch scrolling in overflow panels', async () => {
    const toolbar = await readFile('src/components/studio/StudioToolbar2.jsx', 'utf8');
    const history = await readFile('src/components/studio/TrackVersionHistory.jsx', 'utf8');
    const stems = await readFile('src/components/studio/StemQueue.jsx', 'utf8');
    const keyboard = await readFile('src/components/studio/KeyboardShortcutsDialog.jsx', 'utf8');
    const hardware = await readFile('src/components/studio/HardwarePreferencesDialog.jsx', 'utf8');

    expect(toolbar).toContain('h-[75dvh]');
    expect(history).toContain('max-h-[80dvh]');
    expect(stems).toContain('max-h-[70dvh]');
    for (const source of [toolbar, history, stems, keyboard, hardware]) {
      expect(source).toContain('[-webkit-overflow-scrolling:touch]');
    }
  });
});
