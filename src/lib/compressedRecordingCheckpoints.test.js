import { describe, expect, it, vi } from 'vitest';
import { validateCompressedCheckpoint, startCompressedRecordingCheckpoints } from './compressedRecordingCheckpoints';

describe('mobile compressed recorder crash recovery', () => {
  const chunks = [new Blob([new Uint8Array(3000)],{type:'audio/webm'})];
  it('saves only independently decoded audio, never arbitrary fragments', async () => {
    const close = vi.fn(async()=>{});
    class Context {
      state='running';
      decodeAudioData=vi.fn(async()=>({duration:3.5,numberOfChannels:1,sampleRate:48000}));
      close=close;
    }
    const result=await validateCompressedCheckpoint(chunks,'audio/webm;codecs=opus',{AudioContextType:Context});
    expect(result.audio.size).toBe(3000);
    expect(result.duration).toBe(3.5);
    expect(close).toHaveBeenCalledOnce();
  });
  it('refuses undecodable MP4 fragments and closes the decoder', async () => {
    const close=vi.fn(async()=>{});
    class Context {
      state='running';
      decodeAudioData=async()=>{throw new Error('Incomplete MP4');};
      close=close;
    }
    const result=await validateCompressedCheckpoint(chunks,'audio/mp4',{AudioContextType:Context});
    expect(result).toBeNull();
    expect(close).toHaveBeenCalledOnce();
  });
  it('does not save unsupported formats or oversized chunks', async () => {
    expect(await validateCompressedCheckpoint(chunks,'audio/wav')).toBeNull();
    expect(await validateCompressedCheckpoint([new Blob([new Uint8Array(64)])],'audio/webm')).toBeNull();
  });
  it('never stores fragments when the browser cannot decode them', async () => {
    let scheduled;
    const save=vi.fn();
    const ctl=startCompressedRecordingCheckpoints({
      recorder:{state:'recording',mimeType:'audio/mp4'},chunks,
      ownerId:'owner-123456',scope:'draft',id:'checkpoint-123456',
      validate:async()=>null,save,
      schedule:fn=>{scheduled=fn;return 33},unschedule:()=>{},
    });
    scheduled();await ctl.wait();
    expect(save).not.toHaveBeenCalled();
    ctl.stop();
  });
  it('never blocks final backup after a checkpoint write and warning callback both fail', async () => {
    let tick;
    const originalError = new Error('Storage rejected partial recording');
    const onError = vi.fn(() => { throw new Error('warning handler failed'); });
    const ctl = startCompressedRecordingCheckpoints({
      recorder: { state: 'recording', mimeType: 'audio/webm' }, chunks,
      ownerId: 'owner-123456', scope: 'draft', id: 'checkpoint-safe-wait-001',
      validate: async parts => ({ audio: new Blob(parts, { type: 'audio/webm' }), duration: 2.5 }),
      save: async () => { throw originalError; }, onError,
      schedule: fn => { tick = fn; return 35; }, unschedule: () => {},
    });
    tick(); ctl.stop();
    await expect(ctl.wait()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(originalError);
  });
  it('does not send a stale saved notification after recording stopped', async () => {
    let tick, finishWrite;
    const onSaved = vi.fn();
    const ctl = startCompressedRecordingCheckpoints({
      recorder: { state: 'recording', mimeType: 'audio/webm' }, chunks,
      ownerId: 'owner-123456', scope: 'draft', id: 'checkpoint-stop-001',
      validate: async parts => ({ audio: new Blob(parts, { type: 'audio/webm' }), duration: 2.5 }),
      save: () => new Promise(resolve => { finishWrite = resolve; }), onSaved,
      schedule: fn => { tick = fn; return 36; }, unschedule: () => {},
    });
    tick();
    await vi.waitFor(() => expect(finishWrite).toBeTypeOf('function'));
    ctl.stop();
    finishWrite();
    await ctl.wait();
    expect(onSaved).not.toHaveBeenCalled();
  });
  it('writes validated media to one replaceable, private checkpoint',async()=>{
    let scheduled;const save=vi.fn(async()=>{});
    const recorder={state:'recording',mimeType:'audio/webm'};
    const ctl=startCompressedRecordingCheckpoints({
      recorder,chunks,ownerId:'owner-123456',scope:'room:12345678',
      id:'checkpoint-123456',name:'Lead Vocal',startTime:1.2,save,
      validate:async parts=>({audio:new Blob(parts,{type:'audio/webm'}),duration:2.4}),
      schedule:fn=>{scheduled=fn;return 33},unschedule:()=>{},
    });
    scheduled();await ctl.wait();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      id:'checkpoint-123456',partial:true,replaceExisting:true,
      duration:2.4,scope:'room:12345678',
    }));
    ctl.stop();
    scheduled();await ctl.wait();
    expect(save).toHaveBeenCalledTimes(1);
  });
});
