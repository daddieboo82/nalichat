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

  it('emits buffered PCM as partial WAV before signaling a worklet failure and stop', async () => {
    let node;
    const close = vi.fn().mockResolvedValue(undefined);
    class Context {
      constructor() {
        this.sampleRate = 48000;
        this.destination = {};
        this.audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
      }
      createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
      createGain() { return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }; }
      resume() { return Promise.resolve(); }
      close() { return close(); }
    }
    class WorkletNode {
      constructor() {
        node = this;
        this.port = { postMessage: vi.fn(), onmessage: null, onmessageerror: null };
      }
      connect() {}
      disconnect() {}
    }
    const recorder = await createLosslessStudioRecorder({}, {
      AudioContextType: Context, WorkletNodeType: WorkletNode,
    });
    const events = [];
    let recovered;
    recorder.ondataavailable = event => { recovered = event.data; events.push('data'); };
    recorder.onerror = () => events.push('error');
    recorder.onstop = () => events.push('stop');
    recorder.start();
    const pcm = new Int16Array([123, -456, 789]);
    node.port.onmessage({ data: { type: 'pcm', buffer: pcm.buffer } });
    node.port.onmessageerror();
    await vi.waitFor(() => expect(events).toEqual(['data', 'error', 'stop']));
    const bytes = new DataView(await recovered.arrayBuffer());
    expect(recovered.type).toBe('audio/wav');
    expect(bytes.getUint32(40, true)).toBe(pcm.byteLength);
    expect(bytes.getInt16(44, true)).toBe(123);
    expect(recorder.state).toBe('inactive');
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not emit a fake empty WAV after a worklet failure before audio arrives', async () => {
    let node;
    class Context {
      constructor() {
        this.sampleRate = 48000;
        this.destination = {};
        this.audioWorklet = { addModule: async () => {} };
      }
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
    }
    class WorkletNode {
      constructor() {
        node = this;
        this.port = { postMessage() {}, onmessage: null, onmessageerror: null };
      }
      connect() {}
      disconnect() {}
    }
    const recorder = await createLosslessStudioRecorder({}, {
      AudioContextType: Context, WorkletNodeType: WorkletNode,
    });
    const events = [];
    recorder.ondataavailable = () => events.push('data');
    recorder.onerror = () => events.push('error');
    recorder.onstop = () => events.push('stop');
    recorder.start();
    node.port.onmessageerror();
    await vi.waitFor(() => expect(events).toEqual(['error', 'stop']));
  });

  it('releases the worklet if the Start message fails instead of leaving a phantom recording', async () => {
    let node;
    const close = vi.fn().mockResolvedValue(undefined);
    const disconnect = vi.fn();
    class Context {
      constructor() {
        this.sampleRate = 48000;
        this.destination = {};
        this.audioWorklet = { addModule: async () => {} };
      }
      createMediaStreamSource() { return { connect() {}, disconnect }; }
      createGain() { return { gain: {}, connect() {}, disconnect }; }
      resume() { return Promise.resolve(); }
      close() { return close(); }
    }
    class WorkletNode {
      constructor() {
        node = this;
        this.port = { postMessage: () => { throw new Error('Start port closed'); } };
      }
      connect() {}
      disconnect() { disconnect(); }
    }
    const recorder = await createLosslessStudioRecorder({}, {
      AudioContextType: Context, WorkletNodeType: WorkletNode,
    });
    const onStop = vi.fn();
    recorder.onstop = onStop;
    expect(() => recorder.start()).toThrow('Start port closed');
    expect(recorder.state).toBe('inactive');
    expect(recorder.snapshot()).toBeNull();
    expect(recorder.capturedByteLength).toBe(0);
    recorder.stop();
    recorder.dispose();
    expect(onStop).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(3);
    expect(close).toHaveBeenCalledOnce();
    expect(node.port.postMessage).toBeDefined();
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
