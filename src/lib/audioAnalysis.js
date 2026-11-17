// Measures a bounced mix so AI mastering is grounded in the real audio instead
// of only the session title: loudness (BS.1770-style), peaks, crest factor and
// a four-band frequency balance.

const MAX_SECONDS = 360;

function biquad(type, freq, sampleRate, q = 0.7071, gainDb = 0) {
  const w0 = (2 * Math.PI * freq) / sampleRate;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;

  if (type === "highpass") {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = (1 + cos) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else if (type === "lowpass") {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = (1 - cos) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else if (type === "highshelf") {
    b0 = A * (A + 1 + (A - 1) * cos + 2 * Math.sqrt(A) * alpha);
    b1 = -2 * A * (A - 1 + (A + 1) * cos);
    b2 = A * (A + 1 + (A - 1) * cos - 2 * Math.sqrt(A) * alpha);
    a0 = A + 1 - (A - 1) * cos + 2 * Math.sqrt(A) * alpha;
    a1 = 2 * (A - 1 - (A + 1) * cos);
    a2 = A + 1 - (A - 1) * cos - 2 * Math.sqrt(A) * alpha;
  } else {
    throw new Error(`Unsupported filter type: ${type}`);
  }

  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function applyFilters(samples, filters) {
  let out = samples;
  for (const coeffs of filters) {
    const next = new Float32Array(out.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < out.length; i += 1) {
      const x0 = out[i];
      const y0 = coeffs.b0 * x0 + coeffs.b1 * x1 + coeffs.b2 * x2 - coeffs.a1 * y1 - coeffs.a2 * y2;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
      next[i] = y0;
    }
    out = next;
  }
  return out;
}

function meanSquare(samples) {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  return sum / samples.length;
}

function toDb(meanSq) {
  return meanSq > 0 ? 10 * Math.log10(meanSq) : -100;
}

function round(value, digits = 1) {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export async function analyzeAudioUrl(url) {
  let buffer;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    buffer = await response.arrayBuffer();
  } catch (error) {
    throw new Error("Couldn't read that audio URL. Use a direct link to an MP3 or WAV file.");
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error("This browser cannot analyze audio.");
  const context = new AudioCtx();
  let decoded;
  try {
    decoded = await context.decodeAudioData(buffer.slice(0));
  } catch (error) {
    throw new Error("That file isn't audio this browser can decode. Try an MP3 or WAV bounce.");
  } finally {
    context.close();
  }

  const sampleRate = decoded.sampleRate;
  const channels = Math.min(decoded.numberOfChannels, 2);
  const length = Math.min(decoded.length, Math.floor(sampleRate * MAX_SECONDS));

  // Mono mixdown of the analysed region.
  const mono = new Float32Array(length);
  for (let c = 0; c < channels; c += 1) {
    const data = decoded.getChannelData(c);
    for (let i = 0; i < length; i += 1) mono[i] += data[i] / channels;
  }

  let peak = 0;
  for (let i = 0; i < length; i += 1) {
    const abs = Math.abs(mono[i]);
    if (abs > peak) peak = abs;
  }
  const peakDbfs = peak > 0 ? 20 * Math.log10(peak) : -100;
  const rmsDbfs = toDb(meanSquare(mono));

  // BS.1770-style K-weighting for an integrated-loudness estimate.
  const kWeighted = applyFilters(mono, [
    biquad("highpass", 38, sampleRate, 0.5),
    biquad("highshelf", 1500, sampleRate, 0.7071, 4),
  ]);
  const approxLufs = -0.691 + toDb(meanSquare(kWeighted));

  // Four-band balance: each band measured on its own filtered copy.
  const bands = {
    low_hz: toDb(meanSquare(applyFilters(mono, [biquad("lowpass", 250, sampleRate, 0.7071)]))),
    low_mid_hz: toDb(meanSquare(applyFilters(mono, [
      biquad("highpass", 250, sampleRate, 0.7071),
      biquad("lowpass", 800, sampleRate, 0.7071),
    ]))),
    mid_hz: toDb(meanSquare(applyFilters(mono, [
      biquad("highpass", 800, sampleRate, 0.7071),
      biquad("lowpass", 2500, sampleRate, 0.7071),
    ]))),
    high_hz: toDb(meanSquare(applyFilters(mono, [biquad("highpass", 2500, sampleRate, 0.7071)]))),
  };

  return {
    duration_s: round(decoded.duration, 1),
    analysed_s: round(length / sampleRate, 1),
    sample_rate: sampleRate,
    channels: decoded.numberOfChannels,
    peak_dbfs: round(peakDbfs, 1),
    rms_dbfs: round(rmsDbfs, 1),
    approx_lufs: round(approxLufs, 1),
    crest_factor_db: round(peakDbfs - rmsDbfs, 1),
    band_energy_db: {
      low_below_250hz: round(bands.low_hz, 1),
      low_mid_250_800hz: round(bands.low_mid_hz, 1),
      mid_800_2500hz: round(bands.mid_hz, 1),
      high_above_2500hz: round(bands.high_hz, 1),
    },
  };
}