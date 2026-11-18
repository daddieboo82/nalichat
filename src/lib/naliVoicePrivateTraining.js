import { validateNaliVoiceModel } from './naliVoiceCore';
import { readPrivateNaliVoiceModel, savePrivateNaliVoiceModel, clearPrivateNaliVoiceModel } from './naliVoiceModelStore';
import { isPrivateVoiceTrainingEnabled, setPrivateVoiceTrainingEnabled } from './naliVoiceTrainingConsent';

// Keep updates serialized per owner: older recordings must never overwrite a
// newer model. Each queued update reads the latest checkpoint before training.
const queues = new Map();

async function prepareSamples(blob) {
  if (!blob || blob.size === 0 || blob.size > 50 * 1024 * 1024) {
    throw new Error('Recording is too large for private NaliVoice training.');
  }
  const Context = window.AudioContext || window.webkitAudioContext;
  const Offline = window.OfflineAudioContext || globalThis.OfflineAudioContext;
  if (!Context || !Offline) throw new Error('Browser audio processing is unavailable.');
  const context = new Context();
  let audio;
  try {
    audio = await context.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await context.close().catch(() => {});
  }
  if (!audio || !Number.isFinite(audio.duration) || audio.duration < 1) {
    throw new Error('Recording is too short to train NaliVoice.');
  }
  const seconds = Math.min(20, audio.duration);
  const rate = 16000;
  const offline = new Offline(1, Math.round(rate * seconds), rate);
  const source = offline.createBufferSource();
  source.buffer = audio;
  source.connect(offline.destination);
  source.start(0, 0, seconds);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

export async function trainPrivateNaliVoiceFromRecording(owner, blob, {
  workerFactory,
  readModel = readPrivateNaliVoiceModel,
  saveModel = savePrivateNaliVoiceModel,
  consentCheck = isPrivateVoiceTrainingEnabled,
  prepare = prepareSamples,
} = {}) {
  if (!await consentCheck(owner)) return { skipped: 'not_opted_in' };
  const prior = queues.get(owner) || Promise.resolve();
  const task = prior.catch(() => {}).then(async () => {
    if (!await consentCheck(owner)) return { skipped: 'not_opted_in' };
    const samples = await prepare(blob);
    if (!await consentCheck(owner)) return { skipped: 'not_opted_in' };
    const model = await readModel(owner);
    validateNaliVoiceModel(model);
    const worker = workerFactory
      ? workerFactory()
      : new Worker(new URL('./naliVoice.worker.js', import.meta.url), { type: 'module' });
    let next;
    try {
      next = await new Promise((resolve, reject) => {
        worker.onmessage = ({ data }) => {
          if (data?.type === 'TRAINED') resolve(data.model);
          else if (data?.type === 'ERROR') reject(new Error(data.message || 'Training failed.'));
        };
        worker.onerror = () => reject(new Error('Private NaliVoice training worker failed.'));
        worker.postMessage({ type: 'TRAIN', samples: samples.buffer, model }, [samples.buffer]);
      });
    } finally {
      worker.terminate();
    }
    validateNaliVoiceModel(next);
    // Consent may have been revoked while the asynchronous worker ran.
    if (!await consentCheck(owner)) return { skipped: 'consent_revoked' };
    await saveModel(owner, next);
    return { trained: true, trainedSteps: next.trainedSteps };
  });
  queues.set(owner, task);
  try { return await task; } finally { if (queues.get(owner) === task) queues.delete(owner); }
}

export async function forgetPrivateNaliVoiceTraining(owner) {
  // Revoke first; let any already-running training settle before deleting the
  // checkpoint so its late write cannot recreate a model after erasure.
  await setPrivateVoiceTrainingEnabled(owner, false);
  const pending = queues.get(owner);
  if (pending) await pending.catch(() => {});
  await clearPrivateNaliVoiceModel(owner);
}
