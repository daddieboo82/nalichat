import { describe, expect, it, vi } from 'vitest';
import { pcm16WavBlob, createPreferredStudioRecorder, createLosslessStudioRecorder } from './studioPcmRecorder';

describe('NaliChat genuine 16-bit lossless PCM recording', () => {
  it('generates a valid mono WAV header and preserves PCM bytes exactly', async () => {
    const pcm = new Int16Array([0, 32767, -32768, 16384]);
    const blob = pcm16WavBlob([pcm.buffer], 48000);
    expect(blob.type).toBe('audio/wav');
    const view = new DataView(await blob.arrayBuffer());
    const ascii = (start,n) => Array.from({length:n},(_,i)=>String.fromCharCode(view.getUint8(start+i))).join('');
    expect(ascii(0,4)).toBe('RIFF');
    expect(ascii(8,4)).toBe('WAVE');
    expect(ascii(36,4)).toBe('data');
    expect(view.getUint16(20,true)).toBe(1);
    expect(view.getUint16(22,true)).toBe(1);
    expect(view.getUint32(24,true)).toBe(48000);
    expect(view.getUint32(40,true)).toBe(8);
    expect([0,1,2,3].map(i=>view.getInt16(44+i*2,true))).toEqual(Array.from(pcm));
  });

  it('rejects malformed or oversized PCM buffers rather than creating corrupt media', () => {
    expect(() => pcm16WavBlob([new ArrayBuffer(3)], 48000)).toThrow();
    expect(() => pcm16WavBlob([], 0)).toThrow();
  });

  it('selects worklet lossless recording without invoking MediaRecorder', async () => {
    const stream = {id:'microphone'};
    const result = await createPreferredStudioRecorder(stream, {
      MediaRecorderType: vi.fn(),
      createLossless: vi.fn(async () => ({mimeType:'audio/wav'})),
    });
    expect(result.lossless).toBe(true);
    expect(result.backend).toBe('pcm-worklet');
  });

  it('falls back to a compatible mobile recorder when AudioWorklet is unavailable', async () => {
    const Fallback = vi.fn(function() { this.mimeType = 'audio/mp4'; });
    Fallback.isTypeSupported = value => value === 'audio/mp4';
    const result = await createPreferredStudioRecorder({}, {
      MediaRecorderType: Fallback,
      createLossless: async () => {throw new Error('unsupported');},
    });
    expect(result.lossless).toBe(false);
    expect(result.backend).toBe('media-recorder');
    expect(result.recorder.mimeType).toBe('audio/mp4');
  });

  it('cleans up the worklet and audio context if initialization fails', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    class Context {
      constructor() {
        this.audioWorklet = {addModule: async () => {throw new Error('unsupported');}};
      }
      close() {return close();}
    }
    await expect(createLosslessStudioRecorder({}, {
      AudioContextType: Context, WorkletNodeType: function() {},
    })).rejects.toThrow('unsupported');
    expect(close).toHaveBeenCalledOnce();
  });
});
