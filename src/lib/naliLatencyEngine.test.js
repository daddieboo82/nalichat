import { describe, expect, it, vi } from 'vitest';
import {
  makeLatencyProbe, estimateStudioRoundTrip, NALI_LATENCY_PROBE_MS,
  saveStudioLatencyProfile, readStudioLatencyProfile,
} from './naliLatencyEngine';
import { calibrateNaliStudioLatency } from './naliLatencyCalibration';

function acousticTest({ rate = 16000, latencyMs = 115, jitter = [0, 0, 0], noise = 0.0003, mute = false } = {}) {
  const reference = makeLatencyProbe(rate);
  const starts = NALI_LATENCY_PROBE_MS.map(ms => Math.round(ms * rate / 1000));
  const captured = new Float32Array(rate * 3);
  for (let i = 0; i < captured.length; i++) captured[i] = Math.sin(i * .67) * noise;
  if (!mute) for (let trial = 0; trial < 3; trial++) {
    const shift = Math.round((latencyMs + jitter[trial]) * rate / 1000);
    const start = starts[trial] + shift;
    for (let i = 0; i < reference.length; i++) captured[start + i] += reference[i] * .5;
  }
  return { captured, reference, pulseFrames: starts, sampleRate: rate };
}

describe('NaliChat measured acoustic round-trip latency engine', () => {
  it('detects a calibrated 115ms round-trip with sub-millisecond accuracy', () => {
    const result = estimateStudioRoundTrip(acousticTest());
    expect(result.valid).toBe(true);
    expect(result.roundTripMs).toBeCloseTo(115, 0);
    expect(result.confidence).toBeGreaterThan(.9);
    expect(result.jitterMs).toBeLessThan(1);
  });

  it('rejects absent calibration sound instead of applying an invented offset', () => {
    const result = estimateStudioRoundTrip(acousticTest({mute:true}));
    expect(result.valid).toBe(false);
    expect(result).not.toHaveProperty('roundTripMs');
  });

  it('rejects drift and variable latency across repeated probes', () => {
    const result = estimateStudioRoundTrip(acousticTest({jitter:[-24, 0, 27]}));
    expect(result.valid).toBe(false);
  });

  it('rejects malformed input and does not accept browser output latency as a mic measurement', () => {
    expect(estimateStudioRoundTrip({captured:null})).toMatchObject({valid:false});
    expect(estimateStudioRoundTrip(acousticTest({latencyMs:420})).valid).toBe(false);
  });

  it('keeps only recent, valid device-specific calibration metadata', () => {
    const entries = new Map();
    const storage = {setItem:(k,v)=>entries.set(k,v), getItem:k=>entries.get(k)};
    expect(readStudioLatencyProfile(storage)).toBeNull();
    expect(saveStudioLatencyProfile({valid:true,roundTripMs:90,method:'acoustic-correlation-v1'},storage)).toBe(true);
    expect(readStudioLatencyProfile(storage).roundTripMs).toBe(90);
    for (const [k,v] of entries) entries.set(k,JSON.stringify({...JSON.parse(v),calibratedAt:Date.now()-25*3600000}));
    expect(readStudioLatencyProfile(storage)).toBeNull();
    expect(() => saveStudioLatencyProfile({valid:false},storage)).toThrow();
  });

  it('releases the mic if AudioWorklet initialization fails', async () => {
    const stop = vi.fn();
    class Context {
      constructor() { this.audioWorklet={addModule:async()=>{throw new Error('Worklet unsupported');}}; this.state='running'; }
      close() {this.state='closed';return Promise.resolve();}
    }
    await expect(calibrateNaliStudioLatency({
      AudioContextType:Context,
      AudioWorkletNodeType:function(){},
      mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop}]})},
    })).rejects.toThrow('Worklet unsupported');
    expect(stop).toHaveBeenCalledOnce();
  });
});
