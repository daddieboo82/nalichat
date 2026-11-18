// Original NaliChat acoustic latency measurement: three deterministic
// wideband calibration pulses and normalized cross-correlation. Uses the same
// AudioContext clock for scheduled speaker output and microphone samples.
// Measures combined output + physical path + input delay, NOT network ping.
export const NALI_LATENCY_PROBE_MS = [400, 950, 1500];

export function makeLatencyProbe(sampleRate, samples = 768) {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new Error('Unsupported calibration sample rate.');
  }
  const reference = new Float32Array(samples);
  let random = 0x4e414c49;
  for (let i = 0; i < samples; i++) {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    // Smooth the ends to avoid loud transients and keep safe output level.
    const envelope = Math.sin(Math.PI * i / (samples - 1)) ** 2;
    reference[i] = ((random >>> 0) / 2147483648 - 1) * envelope * 0.24;
  }
  return reference;
}

function findPulse(captured, reference, expected, rate, maxDelayMs) {
  const begin = Math.max(0, expected + Math.round(rate * .004));
  const finish = Math.min(captured.length - reference.length, expected + Math.round(rate * maxDelayMs / 1000));
  if (begin >= finish) return null;
  let referenceEnergy = 0;
  for (let i = 0; i < reference.length; i++) referenceEnergy += reference[i] ** 2;
  if (!referenceEnergy) return null;
  let bestScore = 0, bestFrame = -1;
  // A coarse-to-fine search reduces CPU load on mobile devices without
  // silently discarding peaks between sample positions.
  const scan = (from, to, step) => {
    for (let offset = from; offset <= to; offset += step) {
      let energy = 0, dot = 0;
      for (let i = 0; i < reference.length; i++) {
        const value = captured[offset + i];
        dot += value * reference[i];
        energy += value * value;
      }
      const score = energy > 1e-8 ? Math.abs(dot) / Math.sqrt(energy * referenceEnergy) : 0;
      if (score > bestScore) { bestScore = score; bestFrame = offset; }
    }
  };
  scan(begin, finish, 4);
  if (bestFrame < 0) return null;
  scan(Math.max(begin, bestFrame - 6), Math.min(finish, bestFrame + 6), 1);
  return { milliseconds: (bestFrame - expected) * 1000 / rate, confidence: bestScore };
}

export function estimateStudioRoundTrip({
  captured, reference, pulseFrames, sampleRate, maxDelayMs = 350,
} = {}) {
  if (!(captured instanceof Float32Array) || !(reference instanceof Float32Array) ||
      !Array.isArray(pulseFrames) || pulseFrames.length < 3 || !Number.isFinite(sampleRate)) {
    return { valid: false, reason: 'Calibration audio is unavailable.' };
  }
  const detections = pulseFrames.map(frame =>
    findPulse(captured, reference, frame, sampleRate, maxDelayMs),
  ).filter(Boolean).filter(m => m.confidence >= 0.4 && m.milliseconds >= 4 && m.milliseconds <= maxDelayMs);
  if (detections.length < 3) {
    return { valid: false, reason: 'The calibration sound was not detected reliably. Use your device speaker near the microphone and try again.' };
  }
  const values = detections.map(d => d.milliseconds).sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)];
  const jitter = Math.max(...values) - Math.min(...values);
  if (jitter > 18) {
    return { valid: false, reason: 'The microphone timing varied too much. Try again in a quiet room without Bluetooth.' };
  }
  return {
    valid: true,
    roundTripMs: Math.round(median * 10) / 10,
    jitterMs: Math.round(jitter * 10) / 10,
    confidence: Math.round(Math.min(...detections.map(d => d.confidence)) * 100) / 100,
    sampleRate,
    method: 'acoustic-correlation-v1',
  };
}

// Automatic correction only applies to local overdubs against a backing track,
// never to independent Messaging voice notes or uncalibrated sessions. The
// original WAV remains untouched; clipStart stores the reversible trim.
export function safeNaliOverdubCompensation(profile, { micDeviceId, hasBackingTrack, duration } = {}) {
  if (!hasBackingTrack || !profile?.valid || profile.method !== 'acoustic-correlation-v1' ||
      !Number.isFinite(profile.roundTripMs) || profile.roundTripMs < 4 || profile.roundTripMs > 250 ||
      !Number.isFinite(profile.jitterMs) || profile.jitterMs > 12 ||
      !Number.isFinite(profile.confidence) || profile.confidence < 0.6 ||
      !Number.isFinite(duration) || duration < 1 ||
      !profile.micDeviceId || !micDeviceId || profile.micDeviceId !== micDeviceId ||
      !Number.isFinite(profile.calibratedAt) || Date.now() - profile.calibratedAt > 24 * 3600000 ||
      profile.calibratedAt > Date.now()) return 0;
  return Math.min(profile.roundTripMs / 1000, duration * 0.1);
}

const PROFILE_KEY = 'nalichat-studio-acoustic-latency-v1';
export function saveStudioLatencyProfile(profile, storage = globalThis.localStorage) {
  if (!profile?.valid || !Number.isFinite(profile.roundTripMs)) throw new Error('Only measured calibration can be saved.');
  try { storage?.setItem(PROFILE_KEY, JSON.stringify({ ...profile, calibratedAt: Date.now() })); return true; }
  catch { return false; }
}
export function readStudioLatencyProfile(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(PROFILE_KEY) || 'null');
    if (value?.valid !== true || value.method !== 'acoustic-correlation-v1' ||
        !Number.isFinite(value.roundTripMs) || value.roundTripMs < 4 || value.roundTripMs > 350 ||
        !Number.isFinite(value.calibratedAt) || Date.now() - value.calibratedAt > 24 * 3600000 ||
        value.calibratedAt > Date.now()) return null;
    return value;
  } catch { return null; }
}
