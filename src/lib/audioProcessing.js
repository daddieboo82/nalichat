// Real client-side audio processing helpers (Web Audio API).
// These operate on actual audio data — no simulation.

// Decode an audio URL into an AudioBuffer
async function fetchAudioBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Web Audio is not supported");

  const ctx = new AudioContextClass();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    if (ctx.state !== "closed") {
      await ctx.close().catch(() => {});
    }
  }
}

// Render an AudioBuffer to a WAV Blob (16-bit PCM)
export function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

// Build a peak waveform array (0..1) from an AudioBuffer
export function bufferToWaveform(buffer, numPoints = 2000) {
  const data = buffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(data.length / numPoints));
  const wf = new Array(numPoints);
  let maxVal = 0;
  for (let i = 0; i < numPoints; i++) {
    const start = i * blockSize;
    let sum = 0, n = 0;
    for (let j = 0; j < blockSize; j += Math.max(1, Math.floor(blockSize / 64))) {
      sum += Math.abs(data[start + j] || 0);
      n++;
    }

    const v = sum / (n || 1);
    wf[i] = v;
    if (v > maxVal) maxVal = v;
  }
  return maxVal > 0 ? wf.map(v => v / maxVal) : wf.map(() => 0.05);
}

/* ------------------------------------------------------------------ *
 * FX core — shared by realtime playback and offline render/export so
 * what you hear in the mixer is what lands in the bounce.
 * ------------------------------------------------------------------ */

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const num = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const param = (effect, key, fallback) => num(effect?.params?.[key], fallback);

// Ordered so both the rack UI and the audio graph agree on insert order.
export const FX_CHAIN_ORDER = ['eq', 'comp', 'reverb', 'delay'];

/** Normalize whatever shape a track stores its inserts in ("effects" legacy / "plugins"). */
export function getTrackEffects(track) {
  return (track && (track.effects || track.plugins)) || {};
}

/** Count of inserts that are actually switched on — used for mixer FX badges. */
export function countActiveEffects(effects) {
  if (!effects) return 0;
  return FX_CHAIN_ORDER.reduce((n, id) => {
    const fx = effects[id];
    return n + (fx && fx.enabled !== false ? 1 : 0);
  }, 0);
}

const impulseCache = new WeakMap();

/** Synthesized decaying-noise impulse response for the convolution reverb. */
export function createReverbImpulse(context, { seconds = 2, decay = 2.5 } = {}) {
  const safeSeconds = clamp(num(seconds, 2), 0.05, 6);
  const safeDecay = clamp(num(decay, 2.5), 0.5, 8);
  const key = `${safeSeconds.toFixed(2)}:${safeDecay.toFixed(2)}:${context.sampleRate}`;
  let cache = impulseCache.get(context);
  if (!cache) { cache = new Map(); impulseCache.set(context, cache); }
  if (cache.has(key)) return cache.get(key);

  const length = Math.max(1, Math.floor(context.sampleRate * safeSeconds));
  const impulse = context.createBuffer(2, length, context.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, safeDecay);
    }
  }
  cache.set(key, impulse);
  return impulse;
}

/**
 * Wire the insert chain described by `effects` between `input` and `output`.
 * Created nodes are pushed into `nodes` so callers can tear the chain down.
 */
export function connectPluginChain(context, input, effects, output, nodes = []) {
  const fx = effects || {};
  let node = input;
  const insert = (next) => { node.connect(next); nodes.push(next); node = next; };

  const eq = fx.eq;
  if (eq && eq.enabled !== false) {
    const low = context.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = 180;
    low.gain.value = (param(eq, 'Low', 50) - 50) / 8;
    insert(low);
    const mid = context.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1000;
    mid.Q.value = 0.8;
    mid.gain.value = (param(eq, 'Mid', 50) - 50) / 8;
    insert(mid);
    const high = context.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = 5000;
    high.gain.value = (param(eq, 'High', 50) - 50) / 8;
    insert(high);
  }

  const comp = fx.comp;
  if (comp && comp.enabled !== false) {
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = clamp(-60 + param(comp, 'Threshold', 60) * 0.5, -100, 0);
    compressor.ratio.value = clamp(1 + param(comp, 'Ratio', 40) / 20, 1, 20);
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;
    insert(compressor);
    const makeup = context.createGain();
    makeup.gain.value = Math.pow(10, ((param(comp, 'Gain', 50) - 50) / 10) / 20);
    insert(makeup);
  }

  const reverb = fx.reverb;
  if (reverb && reverb.enabled !== false) {
    const mix = clamp(param(reverb, 'Mix', 20) / 100, 0, 1);
    const size = clamp(param(reverb, 'Size', 30), 0, 100);
    const damp = clamp(param(reverb, 'Damp', 50), 0, 100);
    const merge = context.createGain();
    const dry = context.createGain();
    dry.gain.value = 1 - mix;
    const damping = context.createBiquadFilter();
    damping.type = 'lowpass';
    damping.frequency.value = 900 + (1 - damp / 100) * 11000;
    const convolver = context.createConvolver();
    convolver.normalize = true;
    convolver.buffer = createReverbImpulse(context, {
      seconds: 0.3 + (size / 100) * 3.5,
      decay: 1.5 + (1 - damp / 100) * 2.5,
    });
    const wet = context.createGain();
    wet.gain.value = mix;

    node.connect(dry);
    dry.connect(merge);
    node.connect(damping);
    damping.connect(convolver);
    convolver.connect(wet);
    wet.connect(merge);
    nodes.push(dry, damping, convolver, wet, merge);
    node = merge;
  }

  const delay = fx.delay;
  if (delay && delay.enabled !== false) {
    const mix = clamp(param(delay, 'Mix', 20) / 100, 0, 1);
    const merge = context.createGain();
    const dry = context.createGain();
    dry.gain.value = 1;
    const delayNode = context.createDelay(2);
    delayNode.delayTime.value = 0.05 + clamp(param(delay, 'Time', 30) / 100, 0, 1) * 0.45;
    const feedback = context.createGain();
    feedback.gain.value = clamp(param(delay, 'Feedback', 25) / 100, 0, 0.85);
    const wet = context.createGain();
    wet.gain.value = mix;

    node.connect(dry);
    dry.connect(merge);
    node.connect(delayNode);
    delayNode.connect(feedback);
    feedback.connect(delayNode);
    delayNode.connect(wet);
    wet.connect(merge);
    nodes.push(dry, delayNode, feedback, wet, merge);
    node = merge;
  }

  node.connect(output);
  return nodes;
}

/** Shared "Send 1 (Rev)" return bus. Returns the node tracks send into. */
export function createReverbBus(context, destination, { size = 65, damp = 45, level = 0.9 } = {}) {
  const input = context.createGain();
  const preDelay = context.createDelay(0.5);
  preDelay.delayTime.value = 0.02;
  const damping = context.createBiquadFilter();
  damping.type = 'lowpass';
  damping.frequency.value = 900 + (1 - clamp(damp, 0, 100) / 100) * 9000;
  const convolver = context.createConvolver();
  convolver.normalize = true;
  convolver.buffer = createReverbImpulse(context, { seconds: 0.5 + (clamp(size, 0, 100) / 100) * 3, decay: 2.2 });
  const output = context.createGain();
  output.gain.value = level;

  input.connect(preDelay);
  preDelay.connect(damping);
  damping.connect(convolver);
  convolver.connect(output);
  output.connect(destination);
  return { input, output, nodes: [input, preDelay, damping, convolver, output] };
}

/** Fader value for a track (volume + clip gain), mute/solo handled by callers. */
export function trackGainValue(track) {
  const volume = clamp(num(track?.volume, 75), 0, 100) / 100;
  const clipGain = Math.pow(10, clamp(num(track?.clipGain, 0), -24, 24) / 20);
  return volume * clipGain;
}

/** Pan control value (0..100 in the UI) mapped to StereoPanner's -1..1. */
export function trackPanValue(track) {
  return clamp((num(track?.pan, 50) - 50) / 50, -1, 1);
}

/**
 * Build a full channel strip: fader -> inserts -> pan -> master, plus the
 * post-fader Send 1 tap into the shared reverb bus.
 */
export function connectTrackChain(context, source, track, { destination, reverbBus, gain } = {}) {
  const nodes = [];
  const trackGain = context.createGain();
  trackGain.gain.value = num(gain, trackGainValue(track));
  source.connect(trackGain);
  nodes.push(trackGain);

  const insertsOut = context.createGain();
  nodes.push(insertsOut);
  connectPluginChain(context, trackGain, getTrackEffects(track), insertsOut, nodes);

  let output = insertsOut;
  if (typeof context.createStereoPanner === 'function') {
    const panner = context.createStereoPanner();
    panner.pan.value = trackPanValue(track);
    insertsOut.connect(panner);
    nodes.push(panner);
    output = panner;
  }

  if (destination) output.connect(destination);

  let sendGain = null;
  const send = clamp(num(track?.send1, 0), 0, 100) / 100;
  if (reverbBus && send > 0) {
    sendGain = context.createGain();
    sendGain.gain.value = send;
    output.connect(sendGain);
    sendGain.connect(reverbBus);
    nodes.push(sendGain);
  }

  return { nodes, trackGain, output, sendGain };
}

/** Master bus: send return + master inserts + master fader. */
export function connectMasterChain(context, { masterFx, masterVolume = 100, destination } = {}) {
  const target = destination || context.destination;
  const nodes = [];
  const input = context.createGain();
  const volume = context.createGain();
  volume.gain.value = clamp(num(masterVolume, 100), 0, 100) / 100;
  nodes.push(input, volume);
  connectPluginChain(context, input, masterFx, volume, nodes);
  volume.connect(target);
  const reverbBus = createReverbBus(context, input);
  nodes.push(...reverbBus.nodes);
  return { input, volume, reverbBus: reverbBus.input, nodes };
}

// Apply a biquad filter offline (real DSP) and return new AudioBuffer
async function applyFilter(buffer, type, frequency, Q = 1) {
  const offline = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  const filter = offline.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = Q;
  src.connect(filter);
  filter.connect(offline.destination);
  src.start();
  return await offline.startRendering();
}

// Real stem separation by frequency split:
//   "vocals/highs"  -> high-pass (keeps vocals, hats, presence)
//   "instrumental"  -> low-pass (keeps bass, body, drums)
export async function separateStems(url) {
  const buffer = await fetchAudioBuffer(url);
  const highs = await applyFilter(buffer, 'highpass', 1800, 0.7);
  const lows = await applyFilter(buffer, 'lowpass', 1800, 0.7);
  return {
    vocals: {
      url: URL.createObjectURL(audioBufferToWav(highs)),
      waveform: bufferToWaveform(highs),
      duration: highs.duration,
    },
    instrumental: {
      url: URL.createObjectURL(audioBufferToWav(lows)),
      waveform: bufferToWaveform(lows),
      duration: lows.duration,
    },
  };
}

// Mix multiple studio tracks down to a single AudioBuffer (offline render).
// Respects startTime, volume/clip gain, mute/solo, pan, inserts, Send 1 and master FX.
export async function renderMixToBuffer(tracks, options = {}) {
  const { masterVolume = 100, masterFx = null, sampleRate = 44100 } = options;
  const audioTracks = (tracks || []).filter(t => t.audioUrl);
  if (audioTracks.length === 0) return null;

  const hasSolo = audioTracks.some(t => t.solo);
  const active = audioTracks.filter(t => (hasSolo ? t.solo : !t.muted));
  if (active.length === 0) return null;

  const decoded = await Promise.all(active.map(async (t) => ({
    track: t,
    buffer: await fetchAudioBuffer(t.audioUrl),
  })));

  const totalSeconds = Math.max(
    ...decoded.map(d => (d.track.startTime || 0) + d.buffer.duration)
  );
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;

  const length = Math.ceil(totalSeconds * sampleRate);
  const offline = new OfflineAudioContext(2, length, sampleRate);
  const master = connectMasterChain(offline, { masterFx, masterVolume, destination: offline.destination });

  decoded.forEach(({ track, buffer }) => {
    const src = offline.createBufferSource();
    src.buffer = buffer;
    connectTrackChain(offline, src, track, {
      destination: master.input,
      reverbBus: master.reverbBus,
    });
    src.start(Math.max(0, track.startTime || 0));
  });

  return offline.startRendering();
}

// Mix multiple studio tracks down to a single WAV Blob (offline render).
export async function renderMixToWav(tracks, options = {}) {
  const rendered = await renderMixToBuffer(tracks, options);
  if (!rendered) return null;
  return audioBufferToWav(rendered);
}

// Render the mixed-down tracks into an MP3 Blob (128kbps).
export async function renderMixToMp3(tracks, options = {}) {
  const rendered = await renderMixToBuffer(tracks, options);
  if (!rendered) return null;
  const { Mp3Encoder } = await import('lamejs');
  const numChannels = rendered.numberOfChannels >= 2 ? 2 : 1;
  const encoder = new Mp3Encoder(numChannels, rendered.sampleRate, 128);

  const left = rendered.getChannelData(0);
  const right = numChannels === 2 ? rendered.getChannelData(1) : null;

  const toInt16 = (floatArr) => {
    const out = new Int16Array(floatArr.length);
    for (let i = 0; i < floatArr.length; i++) {
      const s = Math.max(-1, Math.min(1, floatArr[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  const leftInt = toInt16(left);
  const rightInt = right ? toInt16(right) : null;

  const blockSize = 1152;
  const mp3Data = [];
  for (let i = 0; i < leftInt.length; i += blockSize) {
    const leftChunk = leftInt.subarray(i, i + blockSize);
    let mp3buf;
    if (numChannels === 2) {
      const rightChunk = rightInt.subarray(i, i + blockSize);
      mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = encoder.encodeBuffer(leftChunk);
    }
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
  }
  const end = encoder.flush();
  if (end.length > 0) mp3Data.push(end);

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

// Real audio synthesis: generate a chord progression melody as actual audio.
export async function generateMelody({ seconds = 8, bpm = 120 } = {}) {
  const sampleRate = 44100;
  const length = Math.floor(seconds * sampleRate);
  const offline = new OfflineAudioContext(2, length, sampleRate);

  // C minor pad-ish progression: Cm, Ab, Eb, Bb
  const chords = [
    [261.63, 311.13, 392.00],
    [207.65, 261.63, 311.13],
    [311.13, 392.00, 466.16],
    [233.08, 293.66, 349.23],
  ];
  const beatDur = 60 / bpm;
  const chordDur = beatDur * 2;
  const master = offline.createGain();
  master.gain.value = 0.25;
  master.connect(offline.destination);

  let t = 0;
  let chordIdx = 0;
  while (t < seconds) {
    const chord = chords[chordIdx % chords.length];
    chord.forEach(freq => {
      const osc = offline.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const g = offline.createGain();
      const lp = offline.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1200;
      // ADSR
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.05);
      g.gain.linearRampToValueAtTime(0.3, t + chordDur * 0.5);
      g.gain.linearRampToValueAtTime(0, t + chordDur);
      osc.connect(lp);
      lp.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + chordDur);
    });
    t += chordDur;
    chordIdx++;
  }

  const rendered = await offline.startRendering();
  return {
    url: URL.createObjectURL(audioBufferToWav(rendered)),
    waveform: bufferToWaveform(rendered),
    duration: rendered.duration,
  };
}