// NaliChat original shared-audio synchronization analyzer.
// Two independently recorded tracks must contain the same audible guide/cue.
// It estimates fixed offset and checks for clock drift WITHOUT altering audio.
const RATE = 1000;
const WINDOW = 0.65;
const MAX_OFFSET = 1.8;

export function sampleSyncGuide(audioBuffer, { maxDuration = 150, sampleRate = RATE } = {}) {
  if (!audioBuffer || !Number.isFinite(audioBuffer.sampleRate) ||
      audioBuffer.sampleRate < 8000 || audioBuffer.numberOfChannels < 1 ||
      !Number.isFinite(audioBuffer.duration) || audioBuffer.duration < 3) {
    throw new Error('Sync Assist requires decoded audio with at least 3 seconds of sound.');
  }
  const total = Math.min(maxDuration, audioBuffer.duration);
  const result = new Float32Array(Math.floor(total * sampleRate));
  const sourceRate = audioBuffer.sampleRate;
  const channels = Math.min(2, audioBuffer.numberOfChannels);
  const sources = Array.from({ length: channels }, (_, c) => audioBuffer.getChannelData(c));
  for (let i = 0; i < result.length; i++) {
    const at = i * sourceRate / sampleRate;
    const lower = Math.floor(at);
    const frac = at - lower;
    let sum = 0;
    for (const channel of sources) {
      const a = channel[Math.min(channel.length - 1, lower)] || 0;
      const b = channel[Math.min(channel.length - 1, lower + 1)] || 0;
      sum += a + frac * (b - a);
    }
    result[i] = sum / channels;
  }
  return result;
}

function correlateSegment(reference, target, refCenter, targetCenter, offset, span) {
  const startT = Math.round(targetCenter - span / 2);
  const startR = Math.round(refCenter - span / 2 + offset);
  if (startT < 0 || startR < 0 || startT + span > target.length || startR + span > reference.length) return null;
  let xy = 0, xx = 0, yy = 0;
  for (let i = 0; i < span; i += 2) {
    const x = target[startT + i], y = reference[startR + i];
    xy += x * y;
    xx += x * x;
    yy += y * y;
  }
  if (xx < 0.001 || yy < 0.001) return null;
  const score = xy / Math.sqrt(xx * yy);
  return Number.isFinite(score) ? score : null;
}

function findAnchor(reference, target, refCenter, targetCenter, { sampleRate, maxOffsetSeconds }) {
  const window = Math.round(WINDOW * sampleRate);
  const radius = Math.round(maxOffsetSeconds * sampleRate);
  let best = { score: -1, offset: 0 };
  let runnerUp = -1;
  const scores = [];
  for (let offset = -radius; offset <= radius; offset += 5) {
    const score = correlateSegment(reference, target, refCenter, targetCenter, offset, window);
    if (score === null) continue;
    scores.push({ offset, score });
    if (score > best.score) best = { offset, score };
  }
  if (best.score < 0) return null;
  for (let offset = best.offset - 7; offset <= best.offset + 7; offset++) {
    const score = correlateSegment(reference, target, refCenter, targetCenter, offset, window);
    if (score !== null && score > best.score) best = { offset, score };
  }
  for (const candidate of scores) {
    if (Math.abs(candidate.offset - best.offset) > Math.round(sampleRate * .09)) {
      runnerUp = Math.max(runnerUp, candidate.score);
    }
  }
  return {
    refSeconds: (refCenter + best.offset) / sampleRate,
    targetSeconds: targetCenter / sampleRate,
    score: best.score,
    separation: best.score - runnerUp,
  };
}

export function estimateSharedTrackSync({
  reference, target, referenceStart = 0, targetStart = 0,
  sampleRate = RATE, maxOffsetSeconds = MAX_OFFSET,
} = {}) {
  if (!(reference instanceof Float32Array) || !(target instanceof Float32Array) ||
      !Number.isFinite(sampleRate) || sampleRate < 200 || sampleRate > 4000 ||
      !Number.isFinite(referenceStart) || !Number.isFinite(targetStart) ||
      referenceStart < 0 || targetStart < 0 ||
      !Number.isFinite(maxOffsetSeconds) || maxOffsetSeconds <= 0 || maxOffsetSeconds > 3) {
    return { valid: false, reason: 'The selected sync reference is invalid.' };
  }
  const lengthSec = Math.min(reference.length, target.length) / sampleRate;
  if (lengthSec < 5) return { valid: false, reason: 'Use recordings at least five seconds long with the same audible sync cue.' };
  const anchors = [0.22, 0.78].map(position => {
    const at = Math.round(lengthSec * position * sampleRate);
    const expectedRef = Math.round((at / sampleRate + targetStart - referenceStart) * sampleRate);
    return findAnchor(reference, target, expectedRef, at, { sampleRate, maxOffsetSeconds });
  });
  if (anchors.some(a => !a || a.score < .8 || a.separation < .12)) {
    return { valid: false, reason: 'These recordings do not contain a sufficiently clear, matching audio cue. No timing was changed.' };
  }
  const starts = anchors.map(a => referenceStart + a.refSeconds - a.targetSeconds);
  const driftMs = Math.round((starts[1] - starts[0]) * 1000 * 10) / 10;
  const suggestedStart = Math.round(starts[0] * 1000) / 1000;
  if (suggestedStart < 0 || suggestedStart > 86400) {
    return { valid: false, reason: 'The matching cue would move the track outside the session timeline.' };
  }
  const confidence = Math.round(Math.min(...anchors.map(a => a.score)) * 100) / 100;
  const driftPpm = Math.round(driftMs / ((anchors[1].targetSeconds - anchors[0].targetSeconds) * 1000) * 1e6);
  if (Math.abs(driftMs) > 15) {
    return {
      valid: false, driftDetected: true, driftMs, driftPpm, confidence,
      reason: 'The tracks appear to drift apart during the recording. A start-time shift alone cannot safely fix this; use the original tracks for manual review.',
    };
  }
  return {
    valid: true, suggestedStart, shiftSeconds: Math.round((suggestedStart - targetStart) * 1000) / 1000,
    driftMs, driftPpm, confidence, method: 'matching-audio-correlation-v1',
    note: 'Only the start time will change. No audio is modified or time-stretched.',
  };
}
