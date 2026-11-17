import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { groupStudioClipLanes } from '../lib/studioClipLanes';

describe('Studio mixer treats split clips as one lane', () => {
  it('passes one mixer strip per visible timeline lane, with clips for VU metering', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const mixer = source.slice(source.indexOf('<MixerPanel'), source.indexOf('</MixerPanel>') + 13);
    expect(mixer).toContain('tracks={groupStudioClipLanes(tracks).map(lane => ({');
    expect(mixer).toContain('...lane.primary, laneClips: lane.clips');
    const lanes = groupStudioClipLanes([
      { id: 1, startTime: 0 }, { id: 2, splitFrom: 1, startTime: 4 }, { id: 3, startTime: 0 },
    ]);
    expect(lanes).toHaveLength(2);
    expect(lanes[0].clips).toHaveLength(2);
  });
  it('applies mixer pan and sends to every split clip with independent automation IDs', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const block = source.slice(source.indexOf('const updateAutomatableTrack ='), source.indexOf('const handleTrackClick ='));
    expect(block).toContain('const laneId = getStudioClipLaneId(target)');
    expect(block).toContain('getStudioClipLaneId(t) !== laneId');
    expect(block).toContain('${t.id}:${property}');
  });
  it('applies FX rack plugin updates to all clips in selected lane', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const block = source.slice(source.indexOf('const handlePluginsChange ='), source.indexOf('const openTrackFx ='));
    expect(block).toContain('const laneId = getStudioClipLaneId(selectedPluginTrack)');
    expect(block).toContain('getStudioClipLaneId(t) === laneId');
  });
  it('meter follows the currently active split clip rather than root only', async () => {
    const source = await readFile('src/components/studio/MixerPanel.jsx', 'utf8');
    expect(source).toContain('track?.laneClips?.length ? track.laneClips : [track]');
    expect(source).toContain('const activeClip = clips.find(clip =>');
    expect(source).toContain('activeClip.clipStart || 0');
  });
});
