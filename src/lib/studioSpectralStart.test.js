import {describe,it,expect,vi} from 'vitest';
import {prepareStudioSpectralStart} from './studioSpectralStart';
function fixture(){let attempt=1,epoch=1,mounted=true;const pending={current:null},reset=vi.fn(()=>{pending.current=null}),warn=vi.fn();let resolve,reject;const prepare=()=>new Promise((a,b)=>{resolve=a;reject=b;});return {pending,reset,warn,changeAttempt:()=>++attempt,changeEpoch:()=>++epoch,unmount:()=>mounted=false,getResolver:()=>resolve,resolve:r=>resolve(r),reject:()=>reject(Error('failure')),start:()=>prepareStudioSpectralStart({pending,attempt,epoch,currentAttempt:()=>attempt,currentEpoch:()=>epoch,mounted:()=>mounted,prepare,reset,warn})};}
describe('spectral transport start ownership',()=>{
 it('permits current ready request',async()=>{const f=fixture(),p=f.start();f.resolve({status:'ready'});expect(await p).toBe(true);expect(f.pending.current).toBeNull();expect(f.warn).not.toHaveBeenCalled();});
 it.each(['changeAttempt','changeEpoch','unmount'])('rejects stale completion after %s',async action=>{const f=fixture(),p=f.start();f[action]();f.resolve({status:'ready'});expect(await p).toBe(false);expect(f.reset).toHaveBeenCalledOnce();expect(f.warn).not.toHaveBeenCalled();});
 it('does not cancel newer preparation',async()=>{const f=fixture(),old=f.start(),resolveOld=f.getResolver();f.reset();f.changeAttempt();const newer=f.start();resolveOld({status:'ready'});expect(await old).toBe(false);expect(f.pending.current).toBe(2);expect(f.reset).toHaveBeenCalledOnce();f.resolve({status:'ready'});expect(await newer).toBe(true);});
 it('warns for current failure',async()=>{const f=fixture(),p=f.start();f.reject();expect(await p).toBe(true);expect(f.warn).toHaveBeenCalledOnce();});
 it('warns for deferred allocation',async()=>{const f=fixture(),p=f.start();f.resolve({status:'deferred'});expect(await p).toBe(true);expect(f.warn).toHaveBeenCalledOnce();});
});
