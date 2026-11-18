// Prefer genuinely lossless browser MediaRecorder codecs when offered, then
// high-bitrate music-quality audio. Most mobile browsers only offer AAC/Opus;
// a codec labeled "WAV" is used only if MediaRecorder says it supports it.
// These options do not change microphone hardware, acoustics or clock sync.
const LOSSLESS = ['audio/wav', 'audio/x-wav', 'audio/flac'];
const HIGH_QUALITY = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg'];
export const STUDIO_RECORDING_TARGET_BITRATE = 256000;

export function selectStudioRecorderOptions(MediaRecorderType) {
  if (typeof MediaRecorderType !== 'function') throw new Error('Recording is unsupported on this browser.');
  const supports = type => {
    try { return MediaRecorderType.isTypeSupported?.(type) === true; } catch { return false; }
  };
  const lossless = LOSSLESS.find(supports);
  if (lossless) return { options: { mimeType: lossless }, lossless: true, codec: lossless };
  const codec = HIGH_QUALITY.find(supports);
  return {
    options: codec ? { mimeType: codec, audioBitsPerSecond: STUDIO_RECORDING_TARGET_BITRATE } :
      { audioBitsPerSecond: STUDIO_RECORDING_TARGET_BITRATE },
    lossless: false, codec: codec || null,
  };
}

export function createStudioMediaRecorder(stream, MediaRecorderType) {
  const choice = selectStudioRecorderOptions(MediaRecorderType);
  try {
    return { recorder: new MediaRecorderType(stream, choice.options), ...choice };
  } catch (error) {
    // Some mobile browsers advertise a codec but reject optional bitrate.
    // Retry without specifying bitrate, preserving the codec if possible.
    const options = choice.codec ? { mimeType: choice.codec } : undefined;
    try {
      return { recorder: new MediaRecorderType(stream, options), ...choice, fellBack: true };
    } catch {
      try {
        return { recorder: new MediaRecorderType(stream), codec: null, lossless: false, fellBack: true };
      } catch {
        throw error;
      }
    }
  }
}

export function studioRecordingExtension(mimeType = '') {
  const mime = mimeType.toLowerCase();
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('flac')) return 'flac';
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}
