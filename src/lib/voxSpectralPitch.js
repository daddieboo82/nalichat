import { resolveVoxSpectralOptions } from './voxSpectralModes.js';

// Experimental, offline spectral pitch shifter. Not connected to live playback.
// Frames retain their original hop spacing; phase propagation tracks the
// measured instantaneous frequency instead of periodically resetting delay taps.
function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len *= 2) {
    const angle = (inverse ? 2 : -2) * Math.PI / len;
    const wr = Math.cos(angle), wi = Math.sin(angle);
    for (let base = 0; base < n; base += len) {
      let ar = 1, ai = 0;
      for (let k = 0; k < len / 2; k++) {
        const i = base + k, j = i + len / 2;
        const br = re[j] * ar - im[j] * ai, bi = re[j] * ai + im[j] * ar;
        re[j] = re[i] - br; im[j] = im[i] - bi;
        re[i] += br; im[i] += bi;
        const next = ar * wr - ai * wi; ai = ar * wi + ai * wr; ar = next;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
const wrap = p => p - 2 * Math.PI * Math.round(p / (2 * Math.PI));

export function createVoxSpectralStream(ratio, options = {}) {
  const { frameSize = 2048, hopSize = 256, formantStrength = 0, levelStrength = 0, sampleRate = 48000 } = resolveVoxSpectralOptions(options);
  if (!Number.isFinite(levelStrength) || levelStrength < 0 || levelStrength > 1) throw new RangeError('Invalid level stabilization');
  if (!Number.isFinite(ratio) || ratio < 0.5 || ratio > 2) throw new RangeError('Unsupported pitch ratio');
  if (!Number.isInteger(frameSize) || frameSize < 256 || frameSize > 8192 || (frameSize & (frameSize - 1)) || !Number.isInteger(hopSize) || hopSize < 1 || hopSize > frameSize / 4) throw new RangeError('Invalid FFT or hop size');
  if (!Number.isFinite(formantStrength) || formantStrength < 0 || formantStrength > 1 || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new RangeError('Invalid spectral envelope settings');
  const n = frameSize, half = n / 2, h = hopSize, step = 2 * Math.PI * h / n;
  const re = new Float64Array(n), im = new Float64Array(n), sr = new Float64Array(n), si = new Float64Array(n);
  const previous = new Float64Array(half + 1), phase = new Float64Array(half + 1);
  const mag = new Float64Array(half + 1), weighted = new Float64Array(half + 1);
  // Low-quefrency cepstral envelope: smooth harmonic detail while retaining
  // broad resonances. Optional and bounded; default pitch behavior unchanged.
  const er = formantStrength ? new Float64Array(n) : null;
  const ei = formantStrength ? new Float64Array(n) : null;
  const lifter = Math.min(half - 1, Math.max(2, Math.round(sampleRate / 500)));
  const win = Float64Array.from({length:n}, (_,i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
  const ring = new Float64Array(n), out = new Float64Array(n*2), norm = new Float64Array(n*2);
  let count = 0, inputPower = 0, outputPower = 0, gain = 1;
  const powerAlpha = Math.exp(-1 / (sampleRate * 0.05));
  const gainAlpha = Math.exp(-1 / (sampleRate * 0.03));
  const frame = () => {
    const start = count - n;
    for (let i = 0; i < n; i++) { const index = start+i; re[i] = (index < 0 ? 0 : ring[index % n]) * win[i]; im[i] = 0; }
    fft(re, im);
    if (er) {
      let peak = 0;
      for (let k = 0; k <= half; k++) peak = Math.max(peak, Math.hypot(re[k], im[k]));
      const floor = Math.max(1e-12, peak * 1e-4);
      for (let k = 0; k < n; k++) { er[k] = Math.log(Math.max(floor, Math.hypot(re[k], im[k]))); ei[k] = 0; }
      fft(er, ei, true);
      for (let k = 1; k < n; k++) {
        const q = Math.min(k, n-k);
        const taper = q >= lifter ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * q / lifter);
        er[k] *= taper; ei[k] *= taper;
      }
      fft(er, ei);
    }
    mag.fill(0); weighted.fill(0); sr.fill(0); si.fill(0);
    for (let k = 0; k <= half; k++) {
      const p = Math.atan2(im[k], re[k]), m = Math.hypot(re[k], im[k]);
      const actual = k + wrap(p - previous[k] - k * step) / step;
      previous[k] = p;
      const target = Math.round(k * ratio), freq = actual * ratio;
      if (target > half || freq < 0 || freq > half) continue;
      const corrected = er ? m * Math.exp(Math.max(-1.3863, Math.min(1.3863, (er[target] - er[k]) * formantStrength))) : m;
      mag[target] += corrected; weighted[target] += corrected * freq;
    }
    for (let k = 0; k <= half; k++) {
      if (mag[k] > 1e-12) phase[k] = wrap(phase[k] + step * weighted[k] / mag[k]);
      sr[k] = mag[k] * Math.cos(phase[k]); si[k] = mag[k] * Math.sin(phase[k]);
      if (k > 0 && k < half) { sr[n-k] = sr[k]; si[n-k] = -si[k]; }
    }
    si[0] = si[half] = 0;
    fft(sr, si, true);
    for (let i = 0; i < n; i++) { const index = start + i; if (index >= 0) { const slot = index % out.length; out[slot] += sr[i] * win[i]; norm[slot] += win[i] * win[i]; } }
  };
  return {
    latencySamples: n,
    reset() {
      // Discard all persistent history; FFT scratch is overwritten per frame.
      ring.fill(0); out.fill(0); norm.fill(0); previous.fill(0); phase.fill(0);
      count=0; inputPower=0; outputPower=0; gain=1;
    },
    process(input, output) {
      if (!(input instanceof Float32Array) || !(output instanceof Float32Array) || input.length !== output.length) throw new TypeError('Expected matching PCM blocks');
      for (let i=0;i<input.length;i++) {
        const x = Number.isFinite(input[i]) ? input[i] : 0;
        const index = count - n;
        if (ratio === 1) { output[i] = index < 0 ? 0 : ring[count % n]; }
        else if (index < 0) output[i] = 0;
        else { const slot = index % out.length; output[i] = norm[slot] > 1e-12 ? out[slot] / norm[slot] : 0; out[slot] = 0; norm[slot] = 0; }
        if (levelStrength && ratio !== 1 && index >= 0) {
          const dry = ring[count % n], wet = output[i];
          inputPower = powerAlpha * inputPower + (1-powerAlpha) * dry * dry;
          outputPower = powerAlpha * outputPower + (1-powerAlpha) * wet * wet;
          // Suppress gain chasing in silence; cap correction at +/-12 dB.
          const target = inputPower > 1e-8 && outputPower > 1e-8
            ? Math.max(0.25, Math.min(4, Math.pow(inputPower/outputPower,levelStrength/2))) : 1;
          gain = gainAlpha * gain + (1-gainAlpha) * target;
          output[i] = wet * gain;
        }
        ring[count % n] = x; count++;
        if (ratio !== 1 && count % h === 0) frame();
      }
    },
  };
}

export function voxSpectralPitch(input, ratio, options = {}) {
  if (!(input instanceof Float32Array)) throw new TypeError('Expected Float32Array PCM');
  const stream = createVoxSpectralStream(ratio, options);
  if (ratio === 1 || !input.length) return input.slice();
  const out = new Float32Array(input.length), delay = stream.latencySamples;
  const padded = new Float32Array(input.length+delay), processed = new Float32Array(padded.length);
  padded.set(input); stream.process(padded, processed); out.set(processed.subarray(delay));
  return out;
}
