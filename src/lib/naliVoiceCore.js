// NaliVoice research engine 0.1: NaliBase-authored, dependency-free,
// trainable sample-domain residual neural network. No third-party weights,
// external voice API, remote training, or Hugging Face downloads.
// This small prototype learns to reverse synthetic noise added to the current
// authorized recording. It is NOT a trained generative singing/voice model.
const TAP_COUNT = 9;
const HIDDEN = 16;
const HALF = (TAP_COUNT - 1) / 2;

function boundSample(x) {
  return Number.isFinite(x) ? Math.max(-0.98, Math.min(0.98, x)) : 0;
}
function tap(samples, index) {
  return samples[Math.min(samples.length - 1, Math.max(0, index))] || 0;
}
function randomGenerator(seed = 0x4e414c49) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function createNaliVoiceModel() {
  const random = randomGenerator();
  const w1 = new Float32Array(TAP_COUNT * HIDDEN);
  const b1 = new Float32Array(HIDDEN);
  const w2 = new Float32Array(HIDDEN);
  for (let j = 0; j < w1.length; j++) w1[j] = (random() - 0.5) * 0.5;
  return { format: 'nalivoice-residual-v1', taps: TAP_COUNT, hidden: HIDDEN, w1, b1, w2, b2: 0, trainedSteps: 0 };
}

export function validateNaliVoiceModel(model) {
  if (!model || model.format !== 'nalivoice-residual-v1' || model.taps !== TAP_COUNT ||
      model.hidden !== HIDDEN || model.w1?.length !== TAP_COUNT * HIDDEN ||
      model.b1?.length !== HIDDEN || model.w2?.length !== HIDDEN ||
      !Number.isFinite(model.b2) || !Number.isSafeInteger(model.trainedSteps)) {
    throw new Error('Invalid NaliVoice model checkpoint.');
  }
  for (const array of [model.w1, model.b1, model.w2]) {
    for (const n of array) if (!Number.isFinite(n) || Math.abs(n) > 100) throw new Error('Invalid NaliVoice weights.');
  }
  return true;
}

function predict(model, sampleAt, index, hidden) {
  for (let neuron = 0; neuron < HIDDEN; neuron++) {
    let activation = model.b1[neuron];
    for (let k = 0; k < TAP_COUNT; k++) {
      activation += sampleAt(index + k - HALF) * model.w1[neuron * TAP_COUNT + k];
    }
    hidden[neuron] = Math.tanh(activation);
  }
  let residual = model.b2;
  for (let neuron = 0; neuron < HIDDEN; neuron++) residual += hidden[neuron] * model.w2[neuron];
  return Math.max(-0.12, Math.min(0.12, residual));
}

// Self-supervised warmup: add synthetic corruption to the selected recording
// and learn a bounded residual against the clean original. The original
// recording is never uploaded or used to clone an unrelated voice.
export function trainNaliVoiceRestorer(model, clean, {
  iterations = 2800, learningRate = 0.016, signal,
} = {}) {
  validateNaliVoiceModel(model);
  if (!(clean instanceof Float32Array) || clean.length < 1024 || clean.length > 2_000_000 ||
      !Number.isSafeInteger(iterations) || iterations < 1 || iterations > 12000) {
    throw new Error('A supported vocal sample is required for NaliVoice training.');
  }
  const random = randomGenerator(0x564f4345);
  const hidden = new Float32Array(HIDDEN);
  const input = new Float32Array(TAP_COUNT);
  const w2Snapshot = new Float32Array(HIDDEN);
  for (let step = 0; step < iterations; step++) {
    if ((step & 127) === 0) signal?.throwIfAborted();
    const index = Math.floor(random() * clean.length);
    const noise = new Float32Array(TAP_COUNT);
    for (let k = 0; k < TAP_COUNT; k++) {
      noise[k] = (random() + random() + random() - 1.5) * 0.026;
      input[k] = boundSample(tap(clean, index + k - HALF) + noise[k]);
    }
    const target = boundSample(tap(clean, index));
    const raw = predict(model, location => input[location - index + HALF] || 0, index, hidden);
    const error = Math.max(-0.2, Math.min(0.2, input[HALF] + raw - target));
    w2Snapshot.set(model.w2);
    for (let neuron = 0; neuron < HIDDEN; neuron++) {
      model.w2[neuron] -= learningRate * error * hidden[neuron];
      model.w2[neuron] = Math.max(-1, Math.min(1, model.w2[neuron]));
    }
    model.b2 = Math.max(-0.12, Math.min(0.12, model.b2 - learningRate * error));
    for (let neuron = 0; neuron < HIDDEN; neuron++) {
      const delta = error * w2Snapshot[neuron] * (1 - hidden[neuron] * hidden[neuron]);
      model.b1[neuron] -= learningRate * delta;
      for (let k = 0; k < TAP_COUNT; k++) {
        model.w1[neuron * TAP_COUNT + k] -= learningRate * delta * input[k];
      }
    }
    model.trainedSteps++;
  }
  validateNaliVoiceModel(model);
  return model;
}

// Always preserve most of the mastered signal: research models may be weak.
// Output is peak-limited, time-aligned, and length-preserving.
export function inferNaliVoice(model, source, { signal, blend = 0.32 } = {}) {
  validateNaliVoiceModel(model);
  if (!(source instanceof Float32Array) || source.length > 2_000_000 ||
      !Number.isFinite(blend) || blend < 0 || blend > 0.5) {
    throw new Error('Invalid audio inference parameters.');
  }
  const result = new Float32Array(source.length);
  const hidden = new Float32Array(HIDDEN);
  for (let i = 0; i < source.length; i++) {
    if ((i & 8191) === 0) signal?.throwIfAborted();
    const residual = predict(model, at => tap(source, at), i, hidden);
    result[i] = boundSample(source[i] + blend * residual);
  }
  return result;
}

export const NALI_VOICE_ENGINE_INFO = Object.freeze({
  name: 'NaliVoice',
  version: '0.1.0',
  architecture: 'NaliBase residual neural restorer',
  modelProvider: 'local self-supervised training',
  externalWeights: false,
  qualityLevel: 'research prototype — not a generative singing model',
});
