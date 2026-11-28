import {describe,it,expect,vi} from 'vitest';
import {createStudioSpectralHold} from './studioSpectralHold';
const setup=()=>{const hold=createStudioSpectralHold(),pause=vi.fn(),onFailure=vi.fn();let finish;const refresh=vi.fn(()=>new Promise(r=>finish=r));return {hold,pause,refresh,onFailure,finish:r=>finish(r),begin:()=>hold.begin({pause,refresh,onFailure})};};
describe('spectral transport hold',()=>{
 it('holds until acknowledged and coalesces rapid jumps',async()=>{const f=setup(),a=f.begin(),b=f.begin();expect(a).toBe(b);expect(f.hold.pending).toBe(true);expect(f.pause).toHaveBeenCalledOnce();expect(f.refresh).toHaveBeenCalledOnce();f.finish({status:'ready'});expect(await a).toBe(true);expect(f.hold.pending).toBe(false);});
 it('cancellation prevents stale failure callbacks',async()=>{const f=setup(),a=f.begin();f.hold.cancel();f.finish({status:'failed'});expect(await a).toBe(false);expect(f.onFailure).not.toHaveBeenCalled();});
 it('failed reset releases hold with explicit fallback',async()=>{const f=setup(),a=f.begin();f.finish({status:'failed'});expect(await a).toBe(false);expect(f.onFailure).toHaveBeenCalledOnce();expect(f.hold.pending).toBe(false);});
 it('old completion cannot release a newer hold',async()=>{const f=setup(),a=f.begin();f.hold.cancel();let done;const b=f.hold.begin({pause:f.pause,refresh:()=>new Promise(r=>done=r),onFailure:f.onFailure});f.finish({status:'ready'});expect(await a).toBe(false);expect(f.hold.pending).toBe(true);done({status:'ready'});expect(await b).toBe(true);});
});
