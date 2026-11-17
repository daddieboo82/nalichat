import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { studioPlaybackPosition } from '../lib/studioPlaybackPosition.js';

describe('Studio recording context uses split clip source offsets', () => {
  it('pre-roll and overdub start only the active audible source segment', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const preRoll = source.slice(source.indexOf('const preRollPlayPromises = [];'), source.indexOf('if (preRollPlayPromises.length > 0)'));
    const overdub = source.slice(source.indexOf('// Overdub: play back existing'), source.indexOf('const audioCtx = new', source.indexOf('// Overdub: play back existing')));
    for (const block of [preRoll, overdub]) {
      expect(block).toContain('studioPlaybackPosition(track, currentTimeRef.current)');
      expect(block).toContain('position.active');
      expect(block).toContain('audio.currentTime = position.sourceTime');
      expect(block).not.toContain('audio.currentTime = currentTimeRef.current');
    }
  });
  it('transport crosses boundaries in recording and does not play armed tracks', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const raf = source.slice(source.indexOf('// Transport crossing:'), source.indexOf('if (isRecording && recordingStartTime'));
    expect(raf).toContain('if (isPlaying || isRecording)');
    expect(raf).toContain('(!isRecording || !isStudioArmedLane(track, sessionTracks))');
    expect(raf).toContain('candidate.currentTime = position.sourceTime');
  });
  it('positions source audio correctly for an overdub starting midway through the right clip', () => {
    const left = {startTime: 10, clipStart: 4, duration: 4};
    const right = {startTime: 14, clipStart: 8, duration: 4};
    expect(studioPlaybackPosition(left, 15).active).toBe(false);
    expect(studioPlaybackPosition(right, 15)).toEqual({active:true,sourceTime:9});
  });
});
