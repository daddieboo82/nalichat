import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { groupStudioClipLanes } from '../lib/studioClipLanes.js';

describe('Studio split clips stay on one visible lane', () => {
  it('renders one track header and one timeline row per lane, with all clips inside', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(source).toContain("groupStudioClipLanes(tracks).map(({ primary: track }, index)");
    expect(source).toContain("map(({ primary: track, clips: laneClips })");
    expect(source).toContain("laneClips.map((clip) => {");
    expect(source).toContain("handleTrackClick(event, track.id)");
    expect(source).toContain("lanes.flatMap(lane => lane.clips)");
    expect(source).toContain("groupStudioClipLanes(tracks).length} Tracks");
  });

  it('applies lane mute/solo and volume consistently across split pieces', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const block = source.slice(source.indexOf('const toggleMute ='), source.indexOf('const updateAutomatableTrack ='));
    expect(block).toContain("const laneId = getStudioClipLaneId(target)");
    expect(block).toContain("getStudioClipLaneId(t) === laneId");
    expect(block).toContain("getStudioClipLaneId(t) !== laneId");
  });

  it('exports one stem per visible lane, combining split-region audio', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const block = source.slice(source.indexOf('const handleExportStems ='), source.indexOf('const handleExportStems =')+2500);
    expect(block).toContain('const audioLanes = groupStudioClipLanes(');
    expect(block).toContain('for (const [index, lane] of audioLanes.entries())');
    expect(block).toContain('renderMixToWav(lane.clips.map(clip => ({');
    expect(block).toContain('Object.keys(zip.files).length !== audioLanes.length');
  });

  it('preserves independent clip records and their time offsets in each lane', () => {
    const left = { id: 7, splitFrom: 7, startTime: 0, clipStart: 4, duration: 5, audioUrl: 'a.wav' };
    const right = { id: 8, splitFrom: 7, startTime: 5, clipStart: 9, duration: 5, audioUrl: 'a.wav' };
    const lanes = groupStudioClipLanes([right, left]);
    expect(lanes.map(l => l.clips.map(c => [c.id, c.clipStart, c.startTime]))).toEqual([[[7,4,0],[8,9,5]]]);
    expect(lanes[0].clips[0]).toBe(left);
    expect(lanes[0].clips[1]).toBe(right);
  });
});
