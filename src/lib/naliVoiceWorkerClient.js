// Cancellable NaliVoice browser worker. The PCM buffer transfers by ownership,
// avoiding copies on memory-constrained phones. The browser never uploads it.
export async function runNaliVoiceWorker(samples, { signal, onStatus, workerFactory } = {}) {
  if (!(samples instanceof Float32Array) || samples.length < 1024 || samples.length > 2_000_000) {
    throw new Error('NaliVoice requires 1–20 seconds of vocal audio.');
  }
  signal?.throwIfAborted();
  const worker = workerFactory
    ? workerFactory()
    : new Worker(new URL('./naliVoice.worker.js', import.meta.url), { type: 'module' });
  let settled = false;
  let abortHandler;
  try {
    onStatus?.('Running NaliVoice neural restoration on your device…');
    return await new Promise((resolve, reject) => {
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', abortHandler);
        worker.terminate();
        if (error) reject(error);
        else resolve(value);
      };
      abortHandler = () => finish(signal.reason || new DOMException('Aborted', 'AbortError'));
      signal?.addEventListener('abort', abortHandler, { once: true });
      if (signal?.aborted) return abortHandler();
      worker.onmessage = event => {
        if (event.data?.type === 'COMPLETE') {
          const buffer = event.data.samples;
          if (!(buffer instanceof ArrayBuffer)) {
            finish(new Error('NaliVoice returned invalid audio.'));
            return;
          }
          finish(null, new Float32Array(buffer));
        } else if (event.data?.type === 'ERROR') {
          finish(new Error(event.data.message || 'NaliVoice processing failed.'));
        }
      };
      worker.onerror = () => finish(new Error('NaliVoice could not run in this browser.'));
      worker.postMessage({ type: 'RESTORE', samples: samples.buffer }, [samples.buffer]);
    });
  } finally {
    worker.terminate();
  }
}
