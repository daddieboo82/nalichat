import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./studioClipAudioRange', () => ({
  studioClipAudioRange: vi.fn(() => ({ offset: 0, duration: 1 })),
}));
vi.mock('./audioProcessing', () => ({
  bufferToWaveform: vi.fn(() => [0.1, 0.4]),
}));

import { convertRvcLocally, validateLocalRvcModels } from './voxRvcLocal';

const file = name => ({
  name,
  size: 5 * 1024,
  arrayBuffer: vi.fn(async () => new ArrayBuffer(5120)),
});
const files = () => ({
  model: file('my-authorized-voice.onnx'),
  contentVec: file('vec-768.onnx'),
  rmvpe: file('RMVPE.onnx'),
});

describe('free browser RVC integration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects missing and unsupported model files before any inference', () => {
    expect(validateLocalRvcModels({})).toMatch(/RVC v2/);
    const models = files();
    models.model.name = 'untrusted.pth';
    expect(validateLocalRvcModels(models)).toMatch(/onnx/);
    models.model = file('voice.onnx');
    expect(validateLocalRvcModels(models)).toBe(null);
  });

  it('enforces a device memory budget before model reads', () => {
    const models = files();
    models.model.size = 600 * 1024 * 1024;
    expect(validateLocalRvcModels(models)).toMatch(/512 MB/);
    expect(models.model.arrayBuffer).not.toHaveBeenCalled();
  });

  it('runs selected models through the local worker without backend requests', async () => {
    const audioData = new Float32Array(16000).fill(0.2);
    const createRVC = vi.fn(settings => settings);
    const runPipelineInWorker = vi.fn(async (context, models, samples, rate, callbacks) => {
      expect(context.assetBaseUrl).toContain('/voxshift/rvc/');
      expect(models.model.name).toBe('my-authorized-voice.onnx');
      expect(samples.length).toBe(16000);
      expect(rate).toBe(16000);
      callbacks.onEvent({ type: 'stage', stage: 'voice_synthesis' });
      return { state: 'success', outputWav: new Blob([new Uint8Array(64)], { type: 'audio/wav' }) };
    });
    const runtimeLoader = vi.fn(async () => ({
      createRVC,
      isWorkerSupported: () => true,
      runPipelineInWorker,
    }));
    class AudioContext {
      async decodeAudioData() {
        return {
          sampleRate: 16000,
          duration: 1,
          length: 16000,
          getChannelData: () => audioData,
        };
      }
      async close() {}
    }
    class OfflineContext {
      constructor(channels, frames, rate) {
        expect(channels).toBe(1);
        expect(frames).toBe(16000);
        expect(rate).toBe(16000);
        this.destination = {};
      }
      createBufferSource() {
        return { connect() {}, start() {}, set buffer(value) { this.value = value; } };
      }
      async startRendering() {
        return { getChannelData: () => audioData };
      }
    }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob([new Uint8Array(128)]),
    }));
    vi.stubGlobal('window', {
      location: { origin: 'https://nalichat.org' },
      AudioContext,
      OfflineAudioContext: OfflineContext,
    });
    vi.stubGlobal('fetch', fetchMock);
    const onStatus = vi.fn();
    const result = await convertRvcLocally({
      track: { audioUrl: 'blob:recorded-vocal' },
      files: files(),
      signal: new AbortController().signal,
      onStatus,
      runtimeLoader,
    });
    expect(runtimeLoader).toHaveBeenCalledOnce();
    expect(runPipelineInWorker).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('blob:recorded-vocal');
    expect(result.processingBackend).toBe('local-rvc');
    expect(result.waveform).toEqual([0.1, 0.4]);
    expect(onStatus).toHaveBeenCalled();
  });

  it('rejects missing files without loading model code', async () => {
    const runtimeLoader = vi.fn();
    await expect(convertRvcLocally({
      track: { audioUrl: 'blob:local' },
      files: {},
      runtimeLoader,
    })).rejects.toThrow();
    expect(runtimeLoader).not.toHaveBeenCalled();
  });
});
