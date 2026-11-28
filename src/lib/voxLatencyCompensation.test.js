import {describe,it,expect,vi} from 'vitest';
import {planVoxLatency,connectVoxCompensation} from './voxLatencyCompensation.js';
import {createVoxSpectralStream} from './voxSpectralPitch.js';
describe('spectral latency compensation',()=>{
  it.each([24000,44100,48000,96000])('aligns dry and all mode latencies at %i Hz',rate=>{
    const tracks=[{id:'dry',latencySamples:0},...['recording','mixing','rendering'].map(id=>({id,latencySamples:createVoxSpectralStream(1.2,{mode:id,sampleRate:rate}).latencySamples}))];
    const plan=planVoxLatency(tracks,rate);expect(plan.latencySamples).toBe(2048);
    expect(plan.tracks.map(t=>t.delaySamples)).toEqual([2048,1536,1024,0]);
    for(let i=0;i<tracks.length;i++)expect(tracks[i].latencySamples+plan.tracks[i].delaySamples).toBe(plan.latencySamples);
  });
  it('supports empty and dry-only sessions',()=>{expect(planVoxLatency([],48000).latencySamples).toBe(0);expect(planVoxLatency([{id:1,latencySamples:0}],48000).tracks[0].delaySamples).toBe(0);});
  it('rejects invalid delay and duplicate IDs',()=>{expect(()=>planVoxLatency([{id:1,latencySamples:-1}],48000)).toThrow();expect(()=>planVoxLatency([{id:1,latencySamples:0},{id:1,latencySamples:1}],48000)).toThrow();expect(()=>planVoxLatency([],0)).toThrow();});
  it('creates and disconnects a dedicated delay without touching other routes',()=>{const node={delayTime:{value:0},connect:vi.fn(),disconnect:vi.fn()},context={sampleRate:48000,createDelay:vi.fn(()=>node)},source={connect:vi.fn(),disconnect:vi.fn()},dest={};const route=connectVoxCompensation(context,source,dest,512);expect(node.delayTime.value).toBe(512/48000);expect(source.connect).toHaveBeenCalledWith(node);expect(node.connect).toHaveBeenCalledWith(dest);route.dispose();expect(source.disconnect).toHaveBeenCalledWith(node);expect(node.disconnect).toHaveBeenCalledOnce();});
  it('bypasses delay allocation for zero compensation',()=>{const context={sampleRate:48000,createDelay:vi.fn()},source={connect:vi.fn(),disconnect:vi.fn()},dest={};connectVoxCompensation(context,source,dest,0).dispose();expect(context.createDelay).not.toHaveBeenCalled();expect(source.disconnect).toHaveBeenCalledWith(dest);});
});
