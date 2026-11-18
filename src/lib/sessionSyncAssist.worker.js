import { estimateSharedTrackSync } from './sessionSyncAssist';

self.onmessage = ({ data }) => {
  if (data?.type !== 'analyze') return;
  try {
    const reference = new Float32Array(data.reference);
    const target = new Float32Array(data.target);
    const result = estimateSharedTrackSync({
      reference, target, referenceStart: data.referenceStart,
      targetStart: data.targetStart,
      sampleRate: data.sampleRate,
    });
    self.postMessage({ type: 'result', result });
  } catch {
    self.postMessage({ type: 'result', result: { valid: false, reason: 'Sync comparison failed. No tracks were changed.' } });
  }
};
