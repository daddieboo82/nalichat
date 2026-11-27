// Best-effort recovery checkpoints for active lossless WAV captures.
// Every snapshot is an independently playable WAV whose bytes are atomically
// replaced in IndexedDB under one owner/session-scoped record. No automatic
// cloud upload, AI voice training, or in-place source audio modification.
import { saveStudioRecoveryTake } from './studioTakeRecovery';

export const MOBILE_RECORDING_CHECKPOINT_MS = 6000;

export async function wavCheckpointDuration(audio) {
  if (!(audio instanceof Blob) || audio.type !== 'audio/wav' || audio.size < 44) return null;
  const view = new DataView(await audio.slice(0, 44).arrayBuffer());
  const fourcc = offset => String.fromCharCode(...new Uint8Array(view.buffer, offset, 4));
  const rate = view.getUint32(24, true);
  const bytes = view.getUint32(40, true);
  if (fourcc(0) !== 'RIFF' || fourcc(8) !== 'WAVE' || fourcc(36) !== 'data' ||
      view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== 1 ||
      view.getUint16(34, true) !== 16 || rate < 8000 || rate > 192000 ||
      bytes !== audio.size - 44 || bytes < rate * 2) return null;
  return bytes / (rate * 2);
}

export function startMobileRecordingCheckpoints({
  recorder, ownerId, scope, id, name, startTime,
  save = saveStudioRecoveryTake, schedule = setInterval, unschedule = clearInterval,
  intervalMs = MOBILE_RECORDING_CHECKPOINT_MS, onSaved, onError,
} = {}) {
  if (!recorder || typeof recorder.snapshot !== 'function' || !ownerId || !scope ||
      typeof id !== 'string' || !id) return null;
  let stopped = false;
  let busy = false;
  let pending = Promise.resolve();
  let lastBytes = 0;
  const tick = () => {
    if (stopped || busy || recorder.state !== 'recording') return;
    // Snapshot creation may throw synchronously when PCM buffers reach the
    // recorder's memory limit or a browser worklet fails. Keep the timer
    // alive and surface the failure through the same recovery warning path.
    let audio;
    try {
      audio = recorder.snapshot();
    } catch (error) {
      try { onError?.(error); } catch { /* best-effort recovery feedback */ }
      return;
    }
    if (!audio || audio.size <= lastBytes) return;
    busy = true;
    pending = (async () => {
      const duration = await wavCheckpointDuration(audio);
      if (!duration || stopped) return;
      await save({
        ownerId, scope, id, name, audio, duration, startTime,
        partial:true, replaceExisting:true,
      });
      lastBytes = audio.size;
      onSaved?.(duration);
    })().catch(error => onError?.(error)).finally(() => { busy = false; });
  };
  const timer = schedule(tick, intervalMs);
  return {
    id, tick,
    stop() { stopped = true; unschedule(timer); },
    wait() { return pending; },
  };
}
