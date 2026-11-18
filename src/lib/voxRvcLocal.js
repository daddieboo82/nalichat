// Free browser-only RVC conversion. Model weights are supplied by the user,
// never uploaded to Base44 or a paid inference service. No automatic model download.
import { bufferToWaveform } from './audioProcessing';
import { studioClipAudioRange } from './studioClipAudioRange';
import { runCancelableRvcWorker } from './rvcWorkerClient';

const MAX_MODEL_BYTES = 512 * 1024 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;

const FILES = [
  ['model', 'RVC v2 voice model'],
  ['contentVec', 'ContentVec model'],
  ['rmvpe', 'RMVPE pitch model'],
];

export function validateLocalRvcModels(files) {
  if (!files || typeof files !== 'object') return 'Choose the three ONNX model files.';
  let total = 0;
  for (const [key, label] of FILES) {
    const file = files[key];
    if (!file || typeof file.name !== 'string' || typeof file.arrayBuffer !== 'function') {
      return `Select the ${label} (.onnx).`;
    }
    if (!/\.onnx$/i.test(file.name)) return `${label} must be a .onnx file.`;
    if (!Number.isSafeInteger(file.size) || file.size < 4096 || file.size > MAX_MODEL_BYTES) {
      return `${label} must be between 4 KB and 512 MB.`;
    }
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) return 'Combined ONNX models must be no larger than 1 GB.';
  return null;
}

async function prepareRvcSource(blob, track, signal) {
  signal?.throwIfAborted();
  if (!blob || blob.size > MAX_SOURCE_BYTES) throw new Error('Source recording exceeds 50 MB.');
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const Offline = window.OfflineAudioContext || globalThis.OfflineAudioContext;
  if (!AudioContextClass || !Offline) throw new Error('This browser lacks offline audio support.');
  const context = new AudioContextClass();
  let decoded;
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await context.close().catch(() => {});
  }
  signal?.throwIfAborted();
  const clip = studioClipAudioRange(track, decoded.duration);
  if (!clip || !Number.isFinite(clip.offset) || !Number.isFinite(clip.duration)
      || clip.duration < 1 || clip.duration > 20) {
    throw new Error('Select 1–20 seconds of isolated vocal for browser AI conversion.');
  }
  const rate = 16000;
  const target = new Offline(1, Math.max(1, Math.round(clip.duration * rate)), rate);
  const source = target.createBufferSource();
  source.buffer = decoded;
  source.connect(target.destination);
  source.start(0, clip.offset, clip.duration);
  const rendered = await target.startRendering();
  signal?.throwIfAborted();
  return rendered.getChannelData(0).slice();
}

export async function convertRvcLocally({ track, files, signal, onStatus, runtimeLoader }) {
  const error = validateLocalRvcModels(files);
  if (error) throw new Error(error);
  if (!track?.audioUrl) throw new Error('Select a vocal recording first.');
  signal?.throwIfAborted();
  onStatus?.('Reading vocal on this device…');
  const response = await fetch(track.audioUrl, { signal });
  if (!response.ok) throw new Error('Could not read the selected vocal clip.');
  const audio = await prepareRvcSource(await response.blob(), track, signal);
  signal?.throwIfAborted();
  onStatus?.('Loading free browser conversion engine…');
  const { createRVC, isWorkerSupported } =
    await (runtimeLoader ? runtimeLoader() : import('rvc-web-runtime'));
  if (!isWorkerSupported()) throw new Error('This browser cannot start the local voice worker.');
  // Serve the MIT-licensed engine worker from this Base44 site. Only ONNX
  // runtime binaries come from a public CDN after an explicit generation click.
  const origin = window.location.origin;
  const context = createRVC({
    assetBaseUrl: `${origin}/voxshift/rvc/`,
    wasmBaseUrl: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/',
  });
  onStatus?.('Converting locally with WebAssembly (CPU)…');
  const result = await runCancelableRvcWorker(
    context,
    { model: files.model, contentVec: files.contentVec, rmvpe: files.rmvpe },
    audio,
    16000,
    {
      signal,
      onEvent: event => {
        if (event?.type === 'stage') onStatus?.(`Voice model: ${String(event.stage).replace(/_/g, ' ')}…`);
        if (event?.type === 'chunk') onStatus?.(`Converting audio chunk ${event.current}/${event.total}…`);
      },
      timeout: 300000,
      options: { medianFilter: true },
    },
  );
  signal?.throwIfAborted();
  if (result?.state !== 'success' || !(result.outputWav instanceof Blob)
      || result.outputWav.size < 44 || result.outputWav.size > 50 * 1024 * 1024) {
    throw new Error(result?.errorMessage || 'Local voice conversion returned no valid WAV output.');
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const decoder = new AudioContextClass();
  let preview;
  try {
    preview = await decoder.decodeAudioData(await result.outputWav.arrayBuffer());
  } finally {
    await decoder.close().catch(() => {});
  }
  signal?.throwIfAborted();
  return {
    blob: result.outputWav,
    duration: preview.duration,
    waveform: bufferToWaveform(preview),
    processingBackend: 'local-rvc',
  };
}
