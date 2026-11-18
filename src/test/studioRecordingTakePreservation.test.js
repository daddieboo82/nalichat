import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { applyStudioRecordedTake, studioNewRecordingLaneCount } from '../lib/studioRecordingTake.js';
const capture = { audioUrl: 'blob:new', waveform: [0.4,0.9], startTime: 12, duration: 3, nextId: 20 };
describe('Studio non-destructive recording takes', () => {
  it('preserves existing split source and timing, creating a separate take lane', () => {
    const original = [
      { id: 1, name:'Lead', splitFrom:1, armed:true, audioUrl:'blob:old', duration:4, startTime:0, clipStart:8, waveform:[0.1] },
      { id: 2, name:'Lead cut', splitFrom:1, armed:false, audioUrl:'blob:old', duration:5, startTime:4, clipStart:12, waveform:[0.2] },
    ];
    expect(studioNewRecordingLaneCount(original)).toBe(1);
    const output = applyStudioRecordedTake(original, capture);
    expect(output).toHaveLength(3);
    expect(output[0]).toMatchObject({audioUrl:'blob:old',clipStart:8,duration:4,armed:false});
    expect(output[1]).toMatchObject({audioUrl:'blob:old',clipStart:12,duration:5});
    expect(output[2]).toMatchObject({id:20,audioUrl:'blob:new',clipStart:0,duration:3,fullDuration:3,startTime:12});
    expect(output[2].splitFrom).toBeUndefined();
    expect(original[0].armed).toBe(true);
  });
  it('compensates measured overdub delay with reversible clip trimming, leaving the source untouched', () => {
    const take = applyStudioRecordedTake([{id:4,name:'Voice',type:'audio',armed:true}], {
      ...capture, duration: 4, latencyCorrectionSeconds:.115,
    })[0];
    expect(take.clipStart).toBeCloseTo(.115);
    expect(take.duration).toBeCloseTo(3.885);
    expect(take.fullDuration).toBe(4);
    expect(take.audioUrl).toBe('blob:new');
    expect(take.latencyCompensationMs).toBe(115);
    const dry = applyStudioRecordedTake([{id:4,name:'Voice',type:'audio',armed:true}],capture)[0];
    expect(dry.clipStart).toBe(0);
  });

  it('records directly into an empty track without allocating a new lane', () => {
    const result = applyStudioRecordedTake([{id:9,name:'Mic',armed:true,waveform:[],duration:0}],capture);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({id:9,audioUrl:'blob:new',clipStart:0,fullDuration:3,armed:false});
  });
  it('leaves unarmed tracks and completed MIDI notes intact', () => {
    const result = applyStudioRecordedTake([
      {id:1,armed:true,type:'midi',midiNotes:[{note:62}]},
      {id:2,armed:false,audioUrl:'backing.wav'},
    ],capture);
    expect(result).toHaveLength(2);
    expect(result[0].midiNotes).toEqual([{note:62}]);
    expect(result[1].audioUrl).toBe('backing.wav');
  });
  it('uses non-destructive take completion and guards track capacity', async () => {
    const src = await readFile('src/pages/Studio.jsx','utf8');
    expect(src).toContain('return applyStudioRecordedTake(');
    expect(src).toContain('tracks.length + studioNewRecordingLaneCount(tracks) > maxTracks');
  });
});
