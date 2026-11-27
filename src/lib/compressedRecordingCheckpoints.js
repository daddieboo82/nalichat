// Device-local partial recovery for browsers that fall back to MediaRecorder.
// Some MP4/AAC streams are not independently decodable until finalization.
// Never save a partial checkpoint unless the browser actually decodes the
// cumulative chunks; otherwise rely on the completed-take backup at Stop.
import { saveStudioRecoveryTake } from './studioTakeRecovery';

export const COMPRESSED_CHECKPOINT_MS = 8000;
const MAX_CHECKPOINT_BYTES = 55 * 1024 * 1024;

export async function validateCompressedCheckpoint(chunks, mimeType, {
  AudioContextType = globalThis.AudioContext || globalThis.webkitAudioContext,
} = {}) {
  if (!Array.isArray(chunks) || !chunks.length || !AudioContextType ||
      typeof mimeType !== 'string' || !/^audio\/(webm|ogg|mp4)(?:;|$)/i.test(mimeType)) return null;
  const size = chunks.reduce((total,chunk) =>
    total + (chunk instanceof Blob ? chunk.size : MAX_CHECKPOINT_BYTES + 1), 0);
  if (size < 1024 || size > MAX_CHECKPOINT_BYTES) return null;
  const audio = new Blob(chunks, { type: mimeType });
  let context;
  try {
    context = new AudioContextType();
    const decoded = await context.decodeAudioData(await audio.arrayBuffer());
    if (!Number.isFinite(decoded.duration) || decoded.duration < 1 ||
        decoded.duration > 24 * 3600 || decoded.numberOfChannels < 1 ||
        decoded.sampleRate < 8000) return null;
    return { audio, duration: decoded.duration };
  } catch {
    return null; // Reject non-playable MP4/WebM fragments.
  } finally {
    if (context && context.state !== 'closed') await context.close().catch(() => {});
  }
}

export function startCompressedRecordingCheckpoints({
  recorder, chunks, ownerId, scope, id, name, startTime,
  validate = validateCompressedCheckpoint, save = saveStudioRecoveryTake,
  schedule = setInterval, unschedule = clearInterval,
  intervalMs = COMPRESSED_CHECKPOINT_MS, onSaved, onError,
} = {}) {
  if (!recorder || typeof recorder.snapshot === 'function' ||
      !Array.isArray(chunks) || !ownerId || !scope ||
      typeof id !== 'string' || !id) return null;
  let stopped = false, busy = false, lastBytes = 0, pending = Promise.resolve();
  // MediaRecorder appends immutable blobs. Account for new chunks once instead
  // of rescanning every captured slice throughout a long mobile session.
  let countedChunks = 0, capturedBytes = 0, exceededLimit = false;
  // A failing notification callback must not reject wait() and prevent
  // Studio from saving the final, complete recording.
  const reportError = error => {
    try { onError?.(error); } catch { /* reporting cannot block final backup */ }
  };
  const tick = () => {
    if (stopped || busy || recorder.state !== 'recording') return;
    // Never decode partial recordings larger than the bounded recovery size.
    // The final recording is handled separately at Stop.
    if (exceededLimit) return;
    if (chunks.length < countedChunks) {
      // Defensive reset if a caller replaced the capture buffer.
      countedChunks = 0;
      capturedBytes = 0;
    }
    let nextBytes = capturedBytes;
    for (let index = countedChunks; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      if (!(chunk instanceof Blob) || !Number.isFinite(chunk.size)) {
        reportError(new Error('Invalid audio capture chunk.'));
        return;
      }
      nextBytes += chunk.size;
      if (nextBytes > MAX_CHECKPOINT_BYTES) {
        exceededLimit = true;
        return;
      }
    }
    capturedBytes = nextBytes;
    countedChunks = chunks.length;
    if (capturedBytes <= lastBytes) return;
    // Snapshot only after bounding its size. No original audio chunks change.
    const copy = chunks.slice();
    const bytes = capturedBytes;
    busy = true;
    pending = (async () => {
      const playable = await validate(copy, recorder.mimeType);
      if (!playable || stopped) return;
      await save({ownerId,scope,id,name,startTime,
        audio:playable.audio,duration:playable.duration,partial:true,replaceExisting:true});
      lastBytes = bytes;
      // A completed device write must not be reported as failed because a
      // progress notification callback threw after persistence succeeded.
      if (!stopped) {
        try { onSaved?.(playable.duration); } catch { /* non-critical progress display */ }
      }
    })().catch(reportError).finally(() => {busy=false;});
  };
  const timer = schedule(tick,intervalMs);
  return {id,tick,stop(){stopped=true;unschedule(timer);},wait(){return pending;}};
}
