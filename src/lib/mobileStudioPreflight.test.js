import { describe,expect,it,vi } from 'vitest';
import { runMobileStudioPreflight } from './mobileStudioPreflight';

function mockStream({live=true,processed=false}={}) {
  const stop=vi.fn();
  const track={readyState:live?'live':'ended',stop,
    getSettings:()=>({sampleRate:48000,echoCancellation:processed})};
  return {stop,getAudioTracks:()=>[track],getTracks:()=>[track]};
}
const storage={estimate:async()=>({quota:200*1024*1024,usage:10*1024*1024})};
describe('mobile Studio microphone preflight',()=>{
  it('checks lossless WAV readiness without recording and closes the mic',async()=>{
    const stream=mockStream();
    const dispose=vi.fn();
    const selectRecorder=vi.fn(async()=>({recorder:{dispose},lossless:true}));
    const result=await runMobileStudioPreflight({
      storage,openMicrophone:async()=>stream,selectRecorder,
      AudioContextType:class{},WorkletNodeType:class{},
    });
    expect(result).toMatchObject({microphone:'ready',recordingEngine:'lossless-wav',
      storageLevel:'ok',sampleRate:48000});
    expect(stream.stop).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
    expect(selectRecorder).toHaveBeenCalledOnce();
  });
  it('reports permission denial and never attempts to open a recorder',async()=>{
    const selectRecorder=vi.fn();
    const error=new Error('denied');error.name='NotAllowedError';
    const result=await runMobileStudioPreflight({
      storage,openMicrophone:async()=>{throw error;},selectRecorder,
    });
    expect(result.microphone).toBe('unavailable');
    expect(result.issues.join(' ')).toMatch(/access is blocked/i);
    expect(selectRecorder).not.toHaveBeenCalled();
  });
  it('releases microphone even when recording engine initialization fails',async()=>{
    const stream=mockStream({processed:true});
    const result=await runMobileStudioPreflight({
      storage,openMicrophone:async()=>stream,
      selectRecorder:async()=>{throw Error('no recorder');},
    });
    expect(result.microphone).toBe('ready');
    expect(result.recordingEngine).toBe('unavailable');
    expect(result.issues.join(' ')).toMatch(/processing enabled/i);
    expect(stream.stop).toHaveBeenCalledOnce();
  });
  it('does not start recording or upload private audio',async()=>{
    const source=await import('node:fs/promises').then(fs=>fs.readFile('src/lib/mobileStudioPreflight.js','utf8'));
    expect(source).not.toMatch(/secureUploadFile|\.start\(|trainPrivateNaliVoice/);
  });
});
