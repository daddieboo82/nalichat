import {describe,it,expect,vi} from 'vitest';
import {createVoxResetHandshake} from './voxResetHandshake';
const fixture=()=>{let listener;const port={addEventListener:(_,fn)=>listener=fn,removeEventListener:vi.fn(),start:vi.fn(),postMessage:vi.fn()};return {port,ack:id=>listener({data:{type:'reset-complete',id}}),handshake:createVoxResetHandshake(port,{timeoutMs:20})};};
describe('worklet reset handshake',()=>{
 it('waits for matching acknowledgment',async()=>{const f=fixture(),p=f.handshake.reset();f.ack(99);f.ack(1);await expect(p).resolves.toBeUndefined();f.handshake.dispose();});
 it('rejects superseded request without canceling newer reset',async()=>{const f=fixture(),old=f.handshake.reset(),check=expect(old).rejects.toThrow('superseded'),next=f.handshake.reset();f.ack(1);await check;f.ack(2);await expect(next).resolves.toBeUndefined();f.handshake.dispose();});
 it('times out missing acknowledgment',async()=>{const f=fixture();await expect(f.handshake.reset()).rejects.toThrow('timed out');f.handshake.dispose();});
 it('rejects pending and future resets after disposal',async()=>{const f=fixture(),p=f.handshake.reset();f.handshake.dispose();await expect(p).rejects.toThrow('disposed');await expect(f.handshake.reset()).rejects.toThrow('disposed');expect(f.port.removeEventListener).toHaveBeenCalledOnce();});
});
