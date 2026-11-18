// Cancelable, same-origin RVC browser worker client.
// Mirrors rvc-web-runtime@1.0.5 worker protocol while allowing Studio to stop inference.
// No model or recording data is sent to a server: structured-clone stays on the device.
export async function runCancelableRvcWorker(
  context, files, audioData, sampleRate, { signal, onEvent, timeout = 300000, options = {}, workerFactory } = {},
) {
  signal?.throwIfAborted();
  if (!Number.isFinite(timeout) || timeout < 1000 || timeout > 300000) {
    throw new Error('Invalid local AI timeout.');
  }
  const [model, contentVec, rmvpe] = await Promise.all([
    files.model.arrayBuffer(),
    files.contentVec.arrayBuffer(),
    files.rmvpe.arrayBuffer(),
  ]);
  signal?.throwIfAborted();
  if (!context.workerUrl?.startsWith(window.location.origin + '/')) {
    throw new Error('Local voice worker must be served from this website.');
  }
  const createWorker = workerFactory || ((url) => new Worker(url, { type: 'module' }));
  const worker = createWorker(context.workerUrl);
  let timer;
  let settled = false;
  let abortHandler;
  try {
    return await new Promise((resolve, reject) => {
      const finish = (failure, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abortHandler);
        worker.terminate();
        if (failure) reject(failure);
        else resolve(value);
      };
      abortHandler = () => finish(signal.reason || new DOMException('Aborted', 'AbortError'));
      signal?.addEventListener('abort', abortHandler, { once: true });
      if (signal?.aborted) return abortHandler();

      timer = setTimeout(() => finish(new Error('Local AI voice conversion timed out.')), timeout);
      worker.onmessage = event => {
        const message = event?.data || {};
        if (message.type === 'EVENT') {
          onEvent?.(message.event);
        } else if (message.type === 'COMPLETE') {
          finish(null, message.result);
        } else if (message.type === 'ERROR') {
          finish(new Error(message.error || 'Local AI voice conversion failed.'));
        }
      };
      worker.onerror = () => finish(new Error('The local voice worker stopped unexpectedly.'));
      worker.postMessage({
        type: 'RUN_PIPELINE',
        wasmBaseUrl: context.wasmBaseUrl,
        audio: { data: audioData, sampleRate },
        files: { model, contentVec, rmvpe },
        fileNames: {
          model: files.model.name,
          contentVec: files.contentVec.name,
          rmvpe: files.rmvpe.name,
        },
        options,
      });
    });
  } finally {
    clearTimeout(timer);
    // Handle unexpected errors before registration or termination.
    worker.terminate();
  }
}
