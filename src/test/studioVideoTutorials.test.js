// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile, stat } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const clips = [
  'public/tutorials/studio-overview.webm',
  'public/tutorials/studio-play-edit.webm',
  'public/tutorials/studio-add-track.webm',
  'public/tutorials/studio-mixer.webm',
  'public/tutorials/studio-recording.webm',
  'public/tutorials/studio-plugins.webm',
  'public/tutorials/studio-export.webm',
];

describe('Studio real-video tutorial experience', () => {
  it('ships real non-empty Studio recordings', async () => {
    for (const path of clips) {
      const info = await stat(new URL(`../../${path}`, import.meta.url));
      expect(info.size).toBeGreaterThan(50_000);
    }
  });

  it('keeps contextual video help available before and during a Studio session', async () => {
    const studio = await readText('src/pages/Studio.jsx');
    expect(studio).toContain("import StudioVideoHelp from '@/components/studio/StudioVideoHelp';");
    expect((studio.match(/<StudioVideoHelp \/>/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('offers task-specific tutorials and a stalled-user hint', async () => {
    const help = await readText('src/components/studio/StudioVideoHelp.jsx');
    for (const topic of ['Studio Quick Tour', 'Play & Edit Clips', 'Add a Track', 'Record a Track', 'Mixer & Levels', 'Plugins & FX', 'Export Your Song']) {
      expect(help).toContain(topic);
    }
    expect(help).toContain('Stuck in Studio?');
    expect(help).toContain('45000');
    expect(help).toContain('studio-video-help');
  });

  it('uses the same real recordings in the Master the Studio homepage section', async () => {
    const home = await readText('src/components/home/StudioTutorial.jsx');
    expect(home).toContain('Real App Experience');
    expect(home).toContain('Recorded in NaliStudio');
    for (const clip of clips) {
      expect(home).toContain(clip.replace('public', ''));
    }
  });

  it('never ships the temporary unauthenticated Studio capture route', async () => {
    const app = await readText('src/App.jsx');
    expect(app).not.toContain('studio-capture');
  });
});
