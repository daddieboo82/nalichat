// Offline, monophonic vocal tuning. Analysis and correction share one contour
// across channels so a stereo take does not drift apart.
const NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SCALES = {
  Maj: [0, 2, 4, 5, 7, 9, 11],
  min: [0, 2, 3, 5, 7, 8, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

function targetRatio(frequency, allowed) {
  const note = 69 + 12 * Math.log2(frequency / 440);
  let nearest = Math.round(note);
  let distance = Infinity;
  for (let candidate = nearest - 3, end = nearest + 3; candidate <= end; candidate++) {
    if (allowed.has((candidate + 120) % 12) && Math.abs(candidate - note) < distance) {
      distance = Math.abs(candidate - note);
      nearest = candidate;
    }
  }
  // Leave small natural fluctuations alone and limit large jumps.
  const movement = nearest - note;
  return Math.abs(movement) < 0.05 ? 1 : 2 ** (Math.max(-1.5, Math.min(1.5, movement)) / 12);
}

function detectPitch(samples, offset, rate) {
  const length = Math.round(rate * 0.03);
  const firstLag = Math.floor(rate / 900);
  const lastLag = Math.ceil(rate / 75);
  const center = Math.max(0, Math.min(samples.length - length - lastLag, offset - (length >> 1)));
  let energy = 0;
  for (let i = 0; i < length; i++) energy += samples[center + i] ** 2;
  if (!(energy / length > 0.000025)) return 0;
  const scores = new Float32Array(lastLag + 1);
  let peak = 0;
  for (let lag = firstLag; lag <= lastLag; lag++) {
    let cross = 0;
    let lagEnergy = 0;
    for (let i = 0; i < length; i++) {
      const sample = samples[center + i + lag];
      cross += samples[center + i] * sample;
      lagEnergy += sample * sample;
    }
    scores[lag] = (2 * cross) / (energy + lagEnergy);
    if (scores[lag] > peak) peak = scores[lag];
  }
  const minimum = Math.max(0.8, peak * 0.94);
  for (let lag = firstLag + 1; lag < lastLag; lag++) {
    const [left, mid, right] = [scores[lag - 1], scores[lag], scores[lag + 1]];
    if (mid >= minimum && mid > left && mid >= right) {
      return rate / (lag + (0.5 * (left - right)) / (left - 2 * mid + right));
    }
  }
  return 0;
}

function sampleAt(channel, position) {
  const index = Math.floor(position);
  const fraction = position - index;
  return (channel[index] ?? 0) * (1 - fraction) + (channel[index + 1] ?? 0) * fraction;
}

const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

export async function correctVocalPitch(input, output, key) {
  const [root, mode] = String(key).split(' ');
  const rootIndex = NOTES.indexOf(root);
  const scale = SCALES[mode];
  const allowed = new Set(rootIndex >= 0 && Array.isArray(scale)
    ? scale.map(interval => (rootIndex + interval) % 12)
    : NOTES.map((_, index) => index));
  const { sampleRate, length, numberOfChannels } = input;
  const channels = Array.from({ length: numberOfChannels }, (_, channel) => input.getChannelData(channel));
  const result = channels.map((_, index) => output.getChannelData(index));

  const stride = Math.max(1, Math.round(sampleRate / 8000));
  const analysisRate = sampleRate / stride;
  const mono = new Float32Array(Math.ceil(length / stride));
  for (let index = 0; index < mono.length; index++) {
    for (const channel of channels) {
      for (let offset = 0; offset < stride; offset++) mono[index] += (channel[index * stride + offset] ?? 0);
    }
    mono[index] /= channels.length * stride;
  }

  const hop = Math.round(sampleRate * 0.015);
  const contour = new Float32Array(Math.ceil(length / hop) + 1);
  let correctedFrames = 0;
  for (let frame = 0; frame < contour.length; frame++) {
    const frequency = detectPitch(mono, Math.round(frame * hop / stride), analysisRate);
    contour[frame] = frequency ? targetRatio(frequency, allowed) : 1;
    if (Math.abs(contour[frame] - 1) > 0.002) correctedFrames++;
    if (frame % 96 === 95) await yieldToBrowser();
  }
  if (!correctedFrames) return false;

  const sweep = sampleRate * 0.026;
  let phase = 0.5;
  for (let index = 0; index < length; index++) {
    const frame = Math.floor(index / hop);
    const weight = (index % hop) / hop;
    const ratio = contour[frame] + (contour[frame + 1] - contour[frame]) * weight;
    phase = (phase + (1 - ratio) / sweep + 1) % 1;
    const alt = (phase + 0.5) % 1;
    const fade = 0.5 - 0.5 * Math.cos(2 * Math.PI * phase);
    const wet = Math.min(1, Math.abs(1 - ratio) / 0.008, index / (sweep / 2), (length - 1 - index) / (sweep / 2));
    for (let ch = 0; ch < channels.length; ch++) {
      const channel = channels[ch];
      const shifted = sampleAt(channel, index - (phase - 0.5) * sweep) * fade
        + sampleAt(channel, index - (alt - 0.5) * sweep) * (1 - fade);
      result[ch][index] = channel[index] + wet * (shifted - channel[index]);
    }
    if (index % 48000 === 47999) await yieldToBrowser();
  }
  return true;
}
