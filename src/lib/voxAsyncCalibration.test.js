import {describe,it,expect,vi} from 'vitest';
import {requestVoxCalibration,createAsyncVoxCalibrationCache} from './voxAsyncCalibration.js';
const profile={method:'main-thread-proxy-v1',sampleRate:48000,costs:{recording:.2,mixing:.3,rendering:.5}};
const mock=()=>({postMessage:vi.fn(),terminate:vi.fn()});
describe('worker calibration',()=>{
 it('accepts valid result and terminates worker',async()=>{const w=mock(),p=requestVoxCalibration(48000,{createWorker:()=>w});w.onmessage({data:{profile}});expect(await p).toEqual(profile);expect(w.terminate).toHaveBeenCalledOnce();});
 it('rejects mismatched rate and malformed profile',async()=>{const w=mock(),p=requestVoxCalibration(44100,{createWorker:()=>w});w.onmessage({data:{profile}});expect(await p).toBeNull();expect(w.terminate).toHaveBeenCalledOnce();});
 it('times out and terminates unresponsive worker',async()=>{const w=mock();expect(await requestVoxCalibration(48000,{createWorker:()=>w,timeoutMs:5})).toBeNull();expect(w.terminate).toHaveBeenCalledOnce();});
 it('handles worker errors and unsupported workers',async()=>{const w=mock(),p=requestVoxCalibration(48000,{createWorker:()=>w});w.onerror();expect(await p).toBeNull();expect(await requestVoxCalibration(48000,{createWorker:()=>{throw Error('unsupported');}})).toBeNull();});
 it('coalesces pending requests and caches completed profile per context',async()=>{const measure=vi.fn(async()=>profile),get=createAsyncVoxCalibrationCache(measure),ctx={sampleRate:48000};const a=get(ctx),b=get(ctx);expect(a).toBe(b);expect(await a).toEqual(profile);expect(await get(ctx)).toEqual(profile);expect(measure).toHaveBeenCalledOnce();expect(await get({state:'closed'})).toBeNull();});
});
