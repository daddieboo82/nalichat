import { describe, expect, it } from 'vitest';
import { studioCaptureHealth, formatCaptureClock, STUDIO_PCM_MEMORY_LIMIT_BYTES, shouldFinalizeMobilePcm } from './studioCaptureHealth';
import { readFile } from 'node:fs/promises';

describe('mobile long-session recording feedback',()=>{
  it('shows time captured separately from time persisted to device storage',()=>{
    const status=studioCaptureHealth({elapsedSeconds:125.8,checkpointSeconds:118.7,pcm:true,capturedBytes:200000});
    expect(status.elapsedLabel).toBe('02:05');
    expect(status.checkpointLabel).toBe('01:58');
    expect(status.detail).toMatch(/recovery checkpoint saved/i);
  });
  it('does not claim protection before IndexedDB confirms a checkpoint',()=>{
    const status=studioCaptureHealth({elapsedSeconds:28,checkpointSeconds:0,pcm:true});
    expect(status.checkpointLabel).toBeNull();
    expect(status.detail).toMatch(/Waiting for the first/i);
  });
  it('warns before PCM recording hits the hard memory limit',()=>{
    const status=studioCaptureHealth({elapsedSeconds:780,checkpointSeconds:750,pcm:true,
      capturedBytes:STUDIO_PCM_MEMORY_LIMIT_BYTES*.78});
    expect(status.memoryWarning).toBe(true);
    expect(status.memoryPercent).toBe(78);
    expect(status.detail).toMatch(/Press Finish/i);
  });
  it('finalizes PCM capture before the recorder hard limit but does not force-stop compressed audio',()=>{
    expect(shouldFinalizeMobilePcm(STUDIO_PCM_MEMORY_LIMIT_BYTES*.89,true)).toBe(false);
    expect(shouldFinalizeMobilePcm(STUDIO_PCM_MEMORY_LIMIT_BYTES*.91,true)).toBe(true);
    expect(shouldFinalizeMobilePcm(STUDIO_PCM_MEMORY_LIMIT_BYTES,false)).toBe(false);
  });
  it('warns after an unsuccessful checkpoint even if an earlier one succeeded',()=>{
    const status=studioCaptureHealth({elapsedSeconds:38,checkpointSeconds:30,checkpointError:true});
    expect(status.detail).toMatch(/could not be updated/i);
  });
  it('keeps compressed capture memory estimate separate from PCM limit',()=>{
    expect(studioCaptureHealth({pcm:false,capturedBytes:STUDIO_PCM_MEMORY_LIMIT_BYTES}).memoryPercent).toBeNull();
    expect(formatCaptureClock(-2)).toBe('00:00');
  });
  it('wires progress updates only to the active recorder and mobile display',async()=>{
    const studio=await readFile('src/pages/Studio.jsx','utf8');
    expect(studio).toContain('setMobileCaptureProgress(prev => ({...prev,checkpointSeconds');
    expect(studio).toContain('mediaRecorderRef.current === mediaRecorder');
    expect(studio).toContain('shouldFinalizeMobilePcm(capturedBytes,pcm,Boolean(recorder.incrementalStorage))');
    expect(studio).toContain('mobileCaptureAutoFinishRef.current = true');
    expect(studio).toContain('aria-label="Mobile recording progress"');
    const recorder=await readFile('src/lib/studioPcmRecorder.js','utf8');
    expect(recorder).toContain('get capturedByteLength() { return byteLength; }');
  });
});
