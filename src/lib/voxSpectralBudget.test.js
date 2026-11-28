import {describe,it,expect} from 'vitest';
import {planVoxWorkload} from './voxSpectralBudget.js';
const tracks=n=>Array.from({length:n},(_,id)=>({id,channels:2,ratio:1.2}));
describe('spectral workload planning',()=>{
 it.each([1,4,8,16,64])('bounds estimated live work for %i tracks',n=>{const p=planVoxWorkload(tracks(n));expect(p.usedMs).toBeLessThanOrEqual(p.budgetMs);expect(p.tracks).toHaveLength(n);for(const t of p.tracks)expect(t.delaySamples+t.latencySamples).toBe(p.latencySamples);});
 it('prioritizes monitored vocals and preserves input ordering',()=>{const t=tracks(12);t[11].monitoring=true;const p=planVoxWorkload(t);expect(p.tracks[11].mode).toBe('recording');expect(p.tracks.map(t=>t.id)).toEqual(t.map(t=>t.id));expect(p.tracks.some(t=>t.status==='deferred')).toBe(true);});
 it('does not spend budget on identity or disabled processing',()=>{const p=planVoxWorkload([{id:1,ratio:1,channels:2},{id:2,ratio:1.2,channels:2,enabled:false}]);expect(p.usedMs).toBe(0);expect(p.tracks.map(t=>t.status)).toEqual(['dry','dry']);});
 it('retains full offline quality without live budget restriction',()=>{const p=planVoxWorkload(tracks(32),{offline:true});expect(p.tracks.every(t=>t.mode==='rendering')).toBe(true);expect(p.latencySamples).toBe(2048);});
 it('rejects invalid configurations',()=>{expect(()=>planVoxWorkload(tracks(1),{reserve:1})).toThrow();expect(()=>planVoxWorkload([{id:1,channels:3,ratio:1.2}])).toThrow();expect(()=>planVoxWorkload([{id:1,channels:1,ratio:NaN}])).toThrow();});
});

it('prioritizes selected tracks under a constrained budget while retaining delay plans for all tracks',()=>{
 const t=tracks(16);t[15].priority=true;const p=planVoxWorkload(t);expect(p.tracks[15].status).toBe('spectral');expect(p.tracks[15].mode).toBe('mixing');expect(p.tracks.filter(t=>t.status==='deferred').every(t=>t.delaySamples===p.latencySamples)).toBe(true);expect(p.usedMs).toBeLessThanOrEqual(p.budgetMs);
});
