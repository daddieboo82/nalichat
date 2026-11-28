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

export function voxSpectralPitch(input, ratio, { frameSize = 2048, hopSize = 256 } = {}) {
  if (!(input instanceof Float32Array)) throw new TypeError('Expected Float32Array PCM');
  if (!Number.isFinite(ratio) || ratio < 0.5 || ratio > 2) throw new RangeError('Unsupported pitch ratio');
  if (!Number.isInteger(frameSize) || frameSize < 256 || frameSize > 8192 || (frameSize & (frameSize - 1)) || !Number.isInteger(hopSize) || hopSize < 1 || hopSize > frameSize / 4) throw new RangeError('Invalid FFT or hop size');
  if (ratio === 1 || !input.length) return input.slice();
  const n = frameSize, half = n / 2, h = hopSize, step = 2 * Math.PI * h / n;
  const re = new Float64Array(n), im = new Float64Array(n), sr = new Float64Array(n), si = new Float64Array(n);
  const previous = new Float64Array(half + 1), phase = new Float64Array(half + 1);
  const mag = new Float64Array(half + 1), weighted = new Float64Array(half + 1);
  const win = Float64Array.from({length:n}, (_,i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
  const out = new Float64Array(input.length), norm = new Float64Array(input.length);
  for (let start = -n; start < input.length; start += h) {
    for (let i = 0; i < n; i++) { const x = input[start+i]; re[i] = (Number.isFinite(x) ? x : 0) * win[i]; im[i] = 0; }
    fft(re, im);
    mag.fill(0); weighted.fill(0); sr.fill(0); si.fill(0);
    for (let k = 0; k <= half; k++) {
      const p = Math.atan2(im[k], re[k]), m = Math.hypot(re[k], im[k]);
      const actual = k + wrap(p - previous[k] - k * step) / step;
      previous[k] = p;
      const target = Math.round(k * ratio), freq = actual * ratio;
      if (target > half || freq < 0 || freq > half) continue;
      mag[target] += m; weighted[target] += m * freq;
    }
    for (let k = 0; k <= half; k++) {
      if (mag[k] > 1e-12) phase[k] = wrap(phase[k] + step * weighted[k] / mag[k]);
      sr[k] = mag[k] * Math.cos(phase[k]); si[k] = mag[k] * Math.sin(phase[k]);
      if (k > 0 && k < half) { sr[n-k] = sr[k]; si[n-k] = -si[k]; }
    }
    si[0] = si[half] = 0;
    fft(sr, si, true);
    for (let i = 0; i < n; i++) { const index = start + i; if (index >= 0 && index < input.length) { out[index] += sr[i] * win[i]; norm[index] += win[i] * win[i]; } }
  }
  return Float32Array.from(out, (x,i) => norm[i] > 1e-12 ? x / norm[i] : 0);
}
