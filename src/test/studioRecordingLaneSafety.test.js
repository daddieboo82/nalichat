import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { isStudioArmedLane } from '../lib/studioRecordingLanes';

describe('Studio record arm and existing split clips', () => {
  const tracks = [
    { id: 8, splitFrom: 8, armed: true, audioUrl: 'same.wav' },
    { id: 9, splitFrom: 8, armed: false, audioUrl: 'same.wav' },
    { id: 10, armed: false, audioUrl: 'backing.wav' },
  ];
  it('treats sibling split clips as one armed lane without arming every clip', () => {
    expect(isStudioArmedLane(tracks[0], tracks)).toBe(true);
    expect(isStudioArmedLane(tracks[1], tracks)).toBe(true);
    expect(isStudioArmedLane(tracks[2], tracks)).toBe(false);
  });
  it('handles empty track lists and orphan split roots', () => {
    expect(isStudioArmedLane({id: 9,splitFrom:8}, [{id:8,armed:true}])).toBe(true);
    expect(isStudioArmedLane({id:9}, [])).toBe(false);
    expect(isStudioArmedLane(null, tracks)).toBe(false);
  });
  it('excludes armed sibling audio from pre-roll, overdub, and RAF transport', async () => {
    const code = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(code.match(/!isStudioArmedLane\(track, tracks\)/g)).toHaveLength(2);
    expect(code).toContain('(!isRecording || !isStudioArmedLane(track, sessionTracks))');
  });
  it('does not erase an existing waveform if recording has no captured audio or is cancelled', async () => {
    const code = await readFile('src/pages/Studio.jsx', 'utf8');
    const block = code.slice(code.indexOf('const stopRecordingProcess ='), code.indexOf('const toggleRecord ='));
    expect(block).toContain('t.armed ? { ...t, armed: false } : t');
    expect(block).toContain('return { ...t, armed: false };');
    expect(block).not.toContain('waveform: [], armed: false');
  });
});
