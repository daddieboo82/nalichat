// Preset pitch ratios and tone settings from VoxShift Calls.
export const VOX_SHIFT_PRESETS = {
  natural: { name: 'Natural', pitch: 100 },
  polished: { name: 'Polished Vocal', pitch: 100 },
  doubled: { name: 'Vocal Doubler', pitch: 100 },
  octave: { name: 'Lower Octave Harmony', pitch: 100 },
  deep: { name: 'Deep Bass', pitch: 72, filter: { type: 'lowpass', frequency: 3800, Q: 0.7 } },
  high: { name: 'High Pitch', pitch: 138, filter: { type: 'highshelf', frequency: 1100, gain: 3 } },
  robot: { name: 'Cyber Robot', pitch: 100 },
  alien: { name: 'Alien', pitch: 122, filter: { type: 'peaking', frequency: 950, Q: 5, gain: 8 } },
  radio: { name: 'Radio', pitch: 100, filter: { type: 'bandpass', frequency: 1400, Q: 0.75 } },
};

const modulationBuffers = new WeakMap();
const delaySweep = 0.03;
const minimumDelay = 0.005;

// Adapt VoxShift's two overlapping delay taps to native stereo Web Audio nodes.
// The fade hides each tap's delay reset, preserving the clip's tempo.
function connectPitchShifter(context, input, ratio, nodes) {
  const rising = ratio < 1;
  let cache = modulationBuffers.get(context);
  if (!cache) {
    cache = new Map();
    modulationBuffers.set(context, cache);
  }
  if (!cache.has(rising)) {
    const size = 4096;
    const buffer = context.createBuffer(2, size, context.sampleRate);
    const ramp = buffer.getChannelData(0);
    const fade = buffer.getChannelData(1);
    for (let index = 0; index < size; index++) {
      const phase = index / size;
      ramp[index] = minimumDelay + delaySweep * (rising ? phase : 1 - phase);
      fade[index] = 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
    }
    cache.set(rising, buffer);
  }
  const modulation = cache.get(rising);
  const output = context.createGain();
  const start = context.currentTime;
  nodes.push(output);

  for (const offset of [0, modulation.duration / 2]) {
    const control = context.createBufferSource();
    control.buffer = modulation;
    control.loop = true;
    control.playbackRate.value = modulation.duration * Math.abs(1 - ratio) / delaySweep;
    const split = context.createChannelSplitter(2);
    const delay = context.createDelay(minimumDelay + delaySweep + 0.01);
    const windowGain = context.createGain();
    windowGain.gain.value = 0;
    control.connect(split);
    split.connect(delay.delayTime, 0);
    split.connect(windowGain.gain, 1);
    input.connect(delay);
    delay.connect(windowGain);
    windowGain.connect(output);
    control.start(start, offset);
    nodes.push(control, split, delay, windowGain);
  }
  return output;
}

// Keep the original performance and pitch while smoothing level and tone.
function connectVocalPolish(context, input, nodes) {
  const rumble = context.createBiquadFilter();
  rumble.type = 'highpass';
  rumble.frequency.value = 75;
  rumble.Q.value = 0.707;

  const mud = context.createBiquadFilter();
  mud.type = 'peaking';
  mud.frequency.value = 280;
  mud.Q.value = 0.9;
  mud.gain.value = -2.5;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -21;
  compressor.knee.value = 20;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.13;

  const presence = context.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3200;
  presence.Q.value = 0.8;
  presence.gain.value = 2;

  const makeup = context.createGain();
  makeup.gain.value = 1.2;

  input.connect(rumble);
  rumble.connect(mud);
  mud.connect(compressor);
  compressor.connect(presence);
  presence.connect(makeup);
  nodes.push(rumble, mud, compressor, presence, makeup);
  return makeup;
}

// Parallel layers leave the lead audible and retain the original clip length.
function connectVocalLayers(context, input, layers, nodes) {
  const mix = context.createGain();
  const lead = context.createGain();
  lead.gain.value = 0.78;
  input.connect(lead);
  lead.connect(mix);
  nodes.push(lead, mix);

  for (const { ratio, delay, gain } of layers) {
    const shifted = connectPitchShifter(context, input, ratio, nodes);
    const offset = context.createDelay(0.05);
    const level = context.createGain();
    offset.delayTime.value = delay;
    level.gain.value = gain;
    shifted.connect(offset);
    offset.connect(level);
    level.connect(mix);
    nodes.push(offset, level);
  }
  return mix;
}

const vocalLayers = {
  doubled: [
    { ratio: 0.994, delay: 0.009, gain: 0.11 },
    { ratio: 1.007, delay: 0.019, gain: 0.11 },
  ],
  octave: [{ ratio: 0.5, delay: 0, gain: 0.22 }],
};

export function connectVoxShift(context, input, params, nodes) {
  const presetId = params?.Preset;
  const preset = Object.hasOwn(VOX_SHIFT_PRESETS, presetId)
    ? VOX_SHIFT_PRESETS[presetId]
    : VOX_SHIFT_PRESETS.natural;
  const pitch = Number.isFinite(params?.Pitch) ? params.Pitch : preset.pitch;
  const ratio = Math.max(60, Math.min(160, pitch)) / 100;
  const level = Number.isFinite(params?.Output) ? params.Output : 100;
  let signal = ratio === 1 ? input : connectPitchShifter(context, input, ratio, nodes);

  if (presetId === 'polished') signal = connectVocalPolish(context, signal, nodes);
  if (Object.hasOwn(vocalLayers, presetId)) {
    signal = connectVocalLayers(context, signal, vocalLayers[presetId], nodes);
  }

  if (preset.filter) {
    const filter = context.createBiquadFilter();
    filter.type = preset.filter.type;
    filter.frequency.value = preset.filter.frequency;
    if (preset.filter.Q !== undefined) filter.Q.value = preset.filter.Q;
    if (preset.filter.gain !== undefined) filter.gain.value = preset.filter.gain;
    signal.connect(filter);
    nodes.push(filter);
    signal = filter;
  }

  if (presetId === 'robot') {
    const oscillator = context.createOscillator();
    oscillator.frequency.value = 52;
    const modulated = context.createGain();
    modulated.gain.value = 0.55;
    oscillator.connect(modulated.gain);
    signal.connect(modulated);
    oscillator.start();
    nodes.push(oscillator, modulated);
    signal = modulated;
  }

  if (level === 100) return signal;
  const output = context.createGain();
  output.gain.value = Math.max(0, Math.min(100, level)) / 100;
  signal.connect(output);
  nodes.push(output);
  return output;
}
