// Original NaliChat shared-session click/count-in.
// Fixed 120 BPM and 4 beats for all collaborators in this first version.
// Every device starts an independent take; identical count-in length is NOT
// network synchronization and never guarantees sample-accurate placement.
export const SHARED_GUIDE_BPM = 120;
export const SHARED_GUIDE_COUNT = 4;
export const SHARED_GUIDE_SECONDS = SHARED_GUIDE_COUNT * 60 / SHARED_GUIDE_BPM;

export function sharedGuideSchedule({ bpm = SHARED_GUIDE_BPM, count = SHARED_GUIDE_COUNT } = {}) {
  if (!Number.isInteger(bpm) || bpm < 40 || bpm > 240 ||
      !Number.isInteger(count) || count < 2 || count > 8) throw new Error('Invalid Studio count-in settings.');
  return Array.from({ length: count }, (_, index) => ({
    beat: index + 1,
    seconds: Math.round(index * 60 / bpm * 1000000) / 1000000,
    strong: index === 0,
  }));
}

// Use oscillator tones created on-demand rather than third-party media assets.
// The click is for MONITORING ONLY, never a rendered part of the take.
export function scheduleSharedSessionGuide(context, { bpm = SHARED_GUIDE_BPM, count = SHARED_GUIDE_COUNT } = {}) {
  const schedule = sharedGuideSchedule({ bpm, count });
  if (!context || typeof context.createOscillator !== 'function' ||
      typeof context.createGain !== 'function' ||
      !Number.isFinite(context.currentTime)) throw new Error('Browser audio playback is unavailable.');
  const start = context.currentTime + 0.08;
  const nodes = [];
  try {
    for (const beat of schedule) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const at = start + beat.seconds;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(beat.strong ? 880 : 620, at);
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(beat.strong ? 0.12 : 0.075, at + 0.004);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.075);
      oscillator.connect(envelope);
      envelope.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.085);
      nodes.push({ oscillator, envelope });
    }
  } catch (error) {
    for (const {oscillator, envelope} of nodes) {
      try { oscillator.stop(); } catch {}
      try { oscillator.disconnect(); envelope.disconnect(); } catch {}
    }
    throw error;
  }
  return {
    durationSeconds: count * 60 / bpm,
    stop() {
      for (const {oscillator, envelope} of nodes) {
        try { oscillator.stop(); } catch {}
        try { oscillator.disconnect(); envelope.disconnect(); } catch {}
      }
    },
  };
}

export async function startSharedSessionGuide({
  AudioContextType = globalThis.AudioContext || globalThis.webkitAudioContext,
  bpm = SHARED_GUIDE_BPM, count = SHARED_GUIDE_COUNT,
} = {}) {
  if (!AudioContextType) throw new Error('Your browser cannot play the Studio count-in.');
  const context = new AudioContextType({latencyHint:'interactive'});
  let guide;
  try {
    await context.resume();
    if (context.state !== 'running') throw new Error('Audio playback was blocked by this device.');
    guide = scheduleSharedSessionGuide(context,{bpm,count});
    let closed = false;
    let timer = null;
    const stop = () => {
      if (closed) return;
      closed = true;
      if (timer !== null) clearTimeout(timer);
      guide.stop();
      void context.close().catch(() => {});
    };
    // Once the four-beat guide finishes, release audio resources even if the
    // performer keeps recording for a long session.
    timer = setTimeout(stop, (guide.durationSeconds + 0.25) * 1000);
    return { durationSeconds: guide.durationSeconds, stop };
  } catch(error) {
    guide?.stop();
    await context.close().catch(() => {});
    throw error;
  }
}
