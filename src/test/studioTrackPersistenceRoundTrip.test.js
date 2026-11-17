import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { hydrateStudioTracks } from '../lib/studioTrackPersistence';
import { groupStudioClipLanes } from '../lib/studioClipLanes';
import { studioPlaybackPosition } from '../lib/studioPlaybackPosition';
import { studioClipAudioRange } from '../lib/studioClipAudioRange';

describe('Studio cloud project split-clip round trip', () => {
  it('preserves clip identities, grouping, and source timing after JSON save/reload', () => {
    const before = [
      { id: 21, splitFrom: 21, audioUrl: 'https://files.example/recording.wav', waveform: [0.2,0.7], startTime: 2, duration: 3, clipStart: 4, fullDuration: 12, volume: 65 },
      { id: 22, splitFrom: 21, file_url: 'https://files.example/recording.wav', waveform: [0.1,0.5], startTime: 5, duration: 4, clipStart: 7, fullDuration: 12, volume: 65 },
    ];
    const saved = JSON.parse(JSON.stringify({ version: 1, tracks: before }));
    const restored = hydrateStudioTracks(saved.tracks);
    expect(restored.map(x => [x.id,x.splitFrom,x.startTime,x.duration,x.clipStart]))
      .toEqual([[21,21,2,3,4],[22,21,5,4,7]]);
    expect(groupStudioClipLanes(restored)).toHaveLength(1);
    expect(restored[1].audioUrl).toBe('https://files.example/recording.wav');
    expect(studioPlaybackPosition(restored[1],5)).toEqual({active:true,sourceTime:7});
    expect(studioClipAudioRange(restored[1],12)).toEqual({when:5,offset:7,duration:4,endsAt:9});
  });

  it('does not invent waveform content for a genuinely empty saved track', () => {
    let fallbackCalls = 0;
    const tracks = hydrateStudioTracks([{id:1,name:'Blank',waveform:[],audioUrl:''}], () => { fallbackCalls++; return [0.5]; });
    expect(tracks[0].waveform).toEqual([]);
    expect(fallbackCalls).toBe(0);
  });

  it('keeps existing recorded waveforms and reconstructs missing waveform only for real audio', () => {
    const restored = hydrateStudioTracks([
      { id:1, audioUrl:'https://files.example/a.wav', waveform:[0.1,0.4] },
      { id:2, audioUrl:'https://files.example/b.wav', waveform:[] },
    ], () => [0.7]);
    expect(restored[0].waveform).toEqual([0.1,0.4]);
    expect(restored[1].waveform).toEqual([0.7]);
  });

  it('wires cloud restoration to the helper without altering legacy fallback', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    expect(source).toContain('const hydrated = hydrateStudioTracks(');
    expect(source).toContain('savedState.tracks,');
    expect(source).toContain('const persistedTracks = await listPersistedTracks(roomId)');
  });
});
