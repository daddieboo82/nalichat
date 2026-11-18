import { describe, expect, it, vi } from 'vitest';
import { runNaliVoiceWorker } from './naliVoiceWorkerClient';

function mockWorker() {
  return { postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null };
}

describe('NaliVoice original worker integration', () => {
  it('transfers PCM locally, then returns neural reconstruction samples', async () => {
    const worker = mockWorker();
    const samples = new Float32Array(16000).fill(0.12);
    const processing = runNaliVoiceWorker(samples, { workerFactory: () => worker });
    expect(worker.postMessage).toHaveBeenCalledOnce();
    const [message, transfers] = worker.postMessage.mock.calls[0];
    expect(message.type).toBe('RESTORE');
    expect(transfers).toContain(message.samples);
    worker.onmessage({ data: { type: 'COMPLETE', samples: new Float32Array([0.1, 0.2]).buffer } });
    const out = await processing;
    expect(Array.from(out)).toEqual(expect.arrayContaining([expect.closeTo(0.1), expect.closeTo(0.2)]));
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('terminates when canceled without creating a model download', async () => {
    const worker = mockWorker();
    const controller = new AbortController();
    const promise = runNaliVoiceWorker(new Float32Array(16000), {
      signal: controller.signal, workerFactory: () => worker,
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).toHaveBeenCalled();
  });

  it('rejects bad audio and avoids starting a worker', async () => {
    const factory = vi.fn();
    await expect(runNaliVoiceWorker(new Float32Array(2), { workerFactory: factory })).rejects.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });
});
