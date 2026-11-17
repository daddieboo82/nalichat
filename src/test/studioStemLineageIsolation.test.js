import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { groupStudioClipLanes } from '../lib/studioClipLanes';

describe('Generated stems stay independent of split source lanes', () => {
  it('clears source clip lineage and trim offsets on both separated stems', async () => {
    const s = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = s.indexOf('const { vocals, instrumental } = await separateStems(track.audioUrl)');
    expect(start).toBeGreaterThan(0);
    const block = s.slice(start, start + 1000);
    expect(block.match(/splitFrom: undefined/g)).toHaveLength(2);
    expect(block.match(/clipStart: 0/g)).toHaveLength(2);
    expect(block).toContain('fullDuration: vocals.duration');
    expect(block).toContain('fullDuration: instrumental.duration');
  });
  it('keeps generated outputs on distinct lanes from the split input', () => {
    const lanes = groupStudioClipLanes([
      { id: 1, splitFrom: 1 }, { id: 2, splitFrom: 1 },
      { id: 3, splitFrom: undefined }, { id: 4, splitFrom: undefined },
    ]);
    expect(lanes.map(l => l.clips.map(c => c.id))).toEqual([[1, 2], [3], [4]]);
  });
  it('does not render muted solo regions into offline exports', async () => {
    const s = await readFile('src/lib/audioProcessing.js','utf8');
    expect(s).toContain('const active = audioTracks.filter(t => !t.muted && (!hasSolo || t.solo))');
  });
});
