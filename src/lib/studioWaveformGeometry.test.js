import { describe, expect, it } from 'vitest';
import { studioWaveformStep, studioWaveformBins } from './studioWaveformGeometry';
describe('adaptive waveform geometry', () => {
  it('retains full detail when the display is wide enough or unknown', () => {
    expect(studioWaveformStep(8000, 8000)).toBe(1);
    expect(studioWaveformStep(8000, undefined)).toBe(1);
    expect(studioWaveformStep(8000, 800)).toBe(10);
  });
  it('preserves peak magnitude and exact source-bin coverage without mutating data', () => {
    const wf = Object.freeze([1,0,.2,-.9,0,.4,0,1]);
    expect(studioWaveformBins(wf,1,7,4)).toEqual([{first:1,last:5,peak:.9},{first:5,last:7,peak:.4}]);
    expect(wf[3]).toBe(-.9);
  });
  it('preserves silence and ignores invalid values', () => {
    expect(studioWaveformBins([0,NaN,Infinity,0],0,4,4)).toEqual([{first:0,last:4,peak:0}]);
  });
  it('retains each individual bin at high zoom', () => {
    expect(studioWaveformBins([0,.5,1],0,3,1)).toEqual([{first:0,last:1,peak:0},{first:1,last:2,peak:.5},{first:2,last:3,peak:1}]);
  });
});
