import { sampleSyncGuide } from './sessionSyncAssist';
import { sessionTrackStart } from './sessionTrackTiming';

async function decodeTrack(context, track, signal, fetchImpl) {
  const url = track?.audioUrl || track?.file_url;
  if (!url || typeof url !== 'string') throw new Error('Both tracks need a saved audio recording.');
  const response = await fetchImpl(url, { signal });
  if (!response.ok) throw new Error('A selected recording could not be loaded. Check access and try again.');
  const bytes = Number(response.headers?.get('content-length'));
  if (Number.isFinite(bytes) && bytes > 30 * 1024 * 1024) throw new Error('This track is too large for the mobile sync check.');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 30 * 1024 * 1024 || buffer.byteLength < 100) throw new Error('Invalid or oversized audio track.');
  signal?.throwIfAborted();
  const decoded = await context.decodeAudioData(buffer);
  signal?.throwIfAborted();
  return sampleSyncGuide(decoded);
}

// Explicit user action only: locally decode two authorized session tracks,
// compare their shared reference cue in a worker and discard the PCM afterward.
// Neither source audio nor model-training data is uploaded by Sync Assist.
export async function analyzeSharedSessionTracks(referenceTrack, targetTrack, {
  signal, fetchImpl = fetch, workerFactory,
  AudioContextType = globalThis.AudioContext || globalThis.webkitAudioContext,
} = {}) {
  if (!referenceTrack?.id || !targetTrack?.id || String(referenceTrack.id) === String(targetTrack.id)) {
    throw new Error('Choose two different recorded tracks to compare.');
  }
  if (!AudioContextType) throw new Error('This browser cannot decode audio for Sync Assist.');
  signal?.throwIfAborted();
  const context = new AudioContextType();
  let worker = null;
  try {
    // Decode sequentially to reduce peak memory on mobile.
    const reference = await decodeTrack(context, referenceTrack, signal, fetchImpl);
    const target = await decodeTrack(context, targetTrack, signal, fetchImpl);
    signal?.throwIfAborted();
    worker = workerFactory ? workerFactory() : new Worker(new URL('./sessionSyncAssist.worker.js', import.meta.url), { type: 'module' });
    return await new Promise((resolve, reject) => {
      let done = false;
      const finish = (error, result) => {
        if (done) return;
        done = true;
        signal?.removeEventListener('abort', abortHandler);
        if (error) reject(error);
        else resolve(result);
      };
      const abortHandler = () => finish(signal.reason || new DOMException('Aborted', 'AbortError'));
      signal?.addEventListener('abort', abortHandler, { once: true });
      if (signal?.aborted) return abortHandler();
      worker.onmessage = event => {
        if (event.data?.type !== 'result') return;
        finish(null, event.data.result);
      };
      worker.onerror = () => finish(new Error('Sync comparison could not run on this device.'));
      worker.postMessage({
        type: 'analyze', reference: reference.buffer, target: target.buffer,
        referenceStart: sessionTrackStart(referenceTrack), targetStart: sessionTrackStart(targetTrack),
        sampleRate: 1000,
      }, [reference.buffer, target.buffer]);
    });
  } finally {
    worker?.terminate();
    if (context.state !== 'closed') await context.close().catch(() => {});
  }
}
