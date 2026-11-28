import {describe,it,expect} from 'vitest';
import {measureVoxDeviceCosts} from './voxDeviceCalibration.js';
import {planVoxWorkload} from './voxSpectralBudget.js';
const tracks=Array.from({length:4},(_,id)=>({id,channels:2,ratio:1.2}));
const profile=(costs,sampleRate=48000)=>({method:'main-thread-proxy-v1',sampleRate,costs});
describe('conservative device workload calibration',()=>{
 it('measures stereo cost with safety margin',()=>{let t=0;const p=measureVoxDeviceCosts({now:()=>t,createStream:()=>({process(){t+=.4;}}),blocks:32,warmup:0});expect(p.costs.recording).toBeCloseTo(.5);expect(p.costs.rendering).toBeCloseTo(.5);});
 it('never raises default capacity on a fast synthetic benchmark',()=>{const normal=planVoxWorkload(tracks),fast=planVoxWorkload(tracks,{calibration:profile({recording:0,mixing:0,rendering:0})});expect(fast.tracks).toEqual(normal.tracks);});
 it('reduces load on slower devices',()=>{const slow=planVoxWorkload(tracks,{calibration:profile({recording:.3,mixing:.6,rendering:1.2})});expect(slow.calibrated).toBe(true);expect(slow.tracks.filter(t=>t.status==='spectral').length).toBeLessThan(planVoxWorkload(tracks).tracks.filter(t=>t.status==='spectral').length);expect(slow.usedMs).toBeLessThanOrEqual(slow.budgetMs);});
 it('ignores invalid and mismatched-rate profiles',()=>{for(const p of [profile({recording:NaN,mixing:1,rendering:1}),profile({recording:1,mixing:1,rendering:1},44100)])expect(planVoxWorkload(tracks,{calibration:p}).calibrated).toBe(false);});
 it('preserves offline rendering quality',()=>{expect(planVoxWorkload(tracks,{offline:true,calibration:profile({recording:100,mixing:100,rendering:100})}).tracks.every(t=>t.mode==='rendering')).toBe(true);});
});
