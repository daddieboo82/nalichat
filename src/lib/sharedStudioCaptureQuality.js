// Best-effort post-take quality check for a Messaging Studio recording.
// Never modify the captured blob and do not block uploading when a browser
// cannot decode a particular container (for example, some mobile codecs).
import { analyzeStudioCaptureQuality } from './studioCaptureQuality';

export async function analyzeSharedStudioRecordedBlob(blob, {
  audioContextFactory = () => new (window.AudioContext || window.webkitAudioContext)(),
} = {}) {
  if (!blob || blob.size === 0 || blob.size > 50 * 1024 * 1024) return null;
  let context;
  try {
    context = audioContextFactory();
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    return analyzeStudioCaptureQuality(audio);
  } catch {
    return null;
  } finally {
    await context?.close?.().catch(() => {});
  }
}
