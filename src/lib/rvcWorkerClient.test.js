import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCancelableRvcWorker } from './rvcWorkerClient';

const context = {
  workerUrl: 'https://nalichat.org/voxshift/rvc/inference.worker.js',
  wasmBaseUrl: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/',
};
const model = name => ({
  name,
  arrayBuffer: vi.fn(async () => new ArrayBuffer(32)),
});
const models = () => ({
  model: model('voice.onnx'), contentVec: model('features.onnx'), rmvpe: model('pitch.onnx'),
});

function fakeWorker() {
  return {
    onmessage: null,
    onerror: null,
    terminate: vi.fn(),
    postMessage: vi.fn(),
  };
}

describe('cancelable local RVC worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('sends model data only into a same-origin worker and resolves output', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://nalichat.org' } });
    const worker = fakeWorker();
    const onEvent = vi.fn();
    const processing = runCancelableRvcWorker(
      context, models(), new Float32Array([0.1]), 16000,
      { onEvent, workerFactory: () => worker },
    );
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledOnce());
    const message = worker.postMessage.mock.calls[0][0];
    expect(message.type).toBe('RUN_PIPELINE');
    expect(message.files.model).toBeInstanceOf(ArrayBuffer);
    expect(message.audio.sampleRate).toBe(16000);
    const transfers = worker.postMessage.mock.calls[0][1];
    expect(transfers).toHaveLength(4);
    expect(transfers.slice(0, 3)).toEqual([message.files.model, message.files.contentVec, message.files.rmvpe]);
    expect(transfers[3]).toBe(message.audio.data.buffer);
    worker.onmessage({ data: { type: 'EVENT', event: { type: 'stage', stage: 'voice_synthesis' } } });
    worker.onmessage({ data: { type: 'COMPLETE', result: { state: 'success' } } });
    await expect(processing).resolves.toEqual({ state: 'success' });
    expect(onEvent).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('terminates the local worker when the user cancels', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://nalichat.org' } });
    const worker = fakeWorker();
    const controller = new AbortController();
    const processing = runCancelableRvcWorker(
      context, models(), new Float32Array([0.2]), 16000,
      { signal: controller.signal, workerFactory: () => worker },
    );
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledOnce());
    controller.abort();
    await expect(processing).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('refuses cross-origin workers', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://nalichat.org' } });
    const workerFactory = vi.fn();
    await expect(runCancelableRvcWorker(
      { ...context, workerUrl: 'https://other.example/worker.js' },
      models(), new Float32Array([0.3]), 16000, { workerFactory },
    )).rejects.toThrow(/this website/);
    expect(workerFactory).not.toHaveBeenCalled();
  });

  it('does not start when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const workerFactory = vi.fn();
    await expect(runCancelableRvcWorker(
      context, models(), new Float32Array([0.2]), 16000,
      { signal: controller.signal, workerFactory },
    )).rejects.toMatchObject({ name: 'AbortError' });
    expect(workerFactory).not.toHaveBeenCalled();
  });
});
