// Preset pitch ratios and tone settings from VoxShift Calls.
export const VOX_SHIFT_PRESETS = {
  natural: { name: 'Natural', pitch: 100 },
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

export function connectVoxShift(context, input, params, nodes) {
  const presetId = params?.Preset;
  const preset = Object.hasOwn(VOX_SHIFT_PRESETS, presetId)
    ? VOX_SHIFT_PRESETS[presetId]
    : VOX_SHIFT_PRESETS.natural;
  const pitch = Number.isFinite(params?.Pitch) ? params.Pitch : preset.pitch;
  const ratio = Math.max(60, Math.min(160, pitch)) / 100;
  const level = Number.isFinite(params?.Output) ? params.Output : 100;
  let signal = ratio === 1 ? input : connectPitchShifter(context, input, ratio, nodes);

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
