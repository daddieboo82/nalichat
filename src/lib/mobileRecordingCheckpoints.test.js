import { describe, expect, it, vi } from 'vitest';
import { pcm16WavBlob } from './studioPcmRecorder';
import { wavCheckpointDuration, startMobileRecordingCheckpoints } from './mobileRecordingCheckpoints';

function wav(seconds=2, rate=8000) {
  const chunk = new Int16Array(seconds * rate);
  for (let i=0;i<chunk.length;i++) chunk[i] = i % 257;
  return pcm16WavBlob([chunk.buffer],rate);
}

describe('incremental Mobile Studio take recovery', () => {
  it('accepts complete independently playable WAV snapshots', async () => {
    expect(await wavCheckpointDuration(wav(3))).toBe(3);
    expect(await wavCheckpointDuration(new Blob(['abc'],{type:'audio/wav'}))).toBeNull();
    expect(await wavCheckpointDuration(new Blob(['abc'],{type:'audio/webm'}))).toBeNull();
  });
  it('persists a growing take under one ID without uploading, training or replacing tracks', async () => {
    let tick;
    const unschedule = vi.fn();
    const save = vi.fn(async()=>({}));
    const recorder = {state:'recording', snapshot:vi.fn().mockReturnValueOnce(wav(2)).mockReturnValueOnce(wav(4))};
    const controller = startMobileRecordingCheckpoints({
      recorder, ownerId:'owner-valid', scope:'draft', id:'snapshot-valid-001', name:'Lead',
      startTime:3, save, schedule:fn=>{tick=fn;return 8},unschedule,
    });
    tick(); await controller.wait();
    tick(); await controller.wait();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls.map(args=>args[0].duration)).toEqual([2,4]);
    expect(save.mock.calls.every(args=>args[0].partial && args[0].replaceExisting)).toBe(true);
    expect(save.mock.calls.every(args=>args[0].id==='snapshot-valid-001')).toBe(true);
    controller.stop();
    tick();await controller.wait();
    expect(save).toHaveBeenCalledTimes(2);
    expect(unschedule).toHaveBeenCalledWith(8);
  });
  it('does not checkpoint lossy recorders, absent owners, or silent PCM', async () => {
    expect(startMobileRecordingCheckpoints({recorder:{state:'recording'},ownerId:'owner-valid',scope:'draft',id:'safe-id-1000'})).toBeNull();
    const save = vi.fn();
    let tick;
    const controller = startMobileRecordingCheckpoints({
      recorder:{state:'recording',snapshot:()=>null},ownerId:'owner-valid',scope:'draft',
      id:'safe-id-1000',save,schedule:fn=>{tick=fn;return 2},unschedule:()=>{},
    });
    tick(); await controller.wait();
    expect(save).not.toHaveBeenCalled();
    controller.stop();
  });
  it('never reports success when the IndexedDB write rejects', async () => {
    const onSaved = vi.fn(), onError = vi.fn();
    let tick;
    const controller = startMobileRecordingCheckpoints({
      recorder:{state:'recording',snapshot:()=>wav(2)},ownerId:'owner-valid',
      scope:'draft',id:'safe-id-1000',
      save: async()=>{throw new Error('Device storage unavailable')},
      schedule:fn=>{tick=fn;return 1},unschedule:()=>{},onSaved,onError,
    });
    tick();await controller.wait();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
    controller.stop();
  });
});
