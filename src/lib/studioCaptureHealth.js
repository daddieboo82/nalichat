// Mobile capture display uses measurements from the active recorder, not
// the track's timeline playhead. The last checkpoint is only the portion
// whose IndexedDB transaction has completed successfully.
export const STUDIO_PCM_MEMORY_LIMIT_BYTES = 80 * 1024 * 1024;
export const STUDIO_CAPTURE_WARNING_RATIO = .75;
export const STUDIO_CAPTURE_AUTO_FINISH_RATIO = .9;
export function shouldFinalizeMobilePcm(capturedBytes, pcm=true) {
  return pcm && Number.isFinite(capturedBytes) && capturedBytes >=
    STUDIO_PCM_MEMORY_LIMIT_BYTES * STUDIO_CAPTURE_AUTO_FINISH_RATIO;
}
export function formatCaptureClock(seconds) {
  const whole = Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
  return `${Math.floor(whole/60).toString().padStart(2,'0')}:${(whole%60).toString().padStart(2,'0')}`;
}
export function studioCaptureHealth({elapsedSeconds=0,checkpointSeconds=0,capturedBytes=0,pcm=false,checkpointError=false}={}) {
  const elapsed=Math.max(0,Number.isFinite(elapsedSeconds)?elapsedSeconds:0);
  const saved=Math.max(0,Math.min(elapsed,Number.isFinite(checkpointSeconds)?checkpointSeconds:0));
  const memoryRatio=pcm && Number.isFinite(capturedBytes)
    ? Math.max(0,capturedBytes)/STUDIO_PCM_MEMORY_LIMIT_BYTES : null;
  const memoryWarning=memoryRatio!==null && memoryRatio>=STUDIO_CAPTURE_WARNING_RATIO;
  return {
    elapsedLabel:formatCaptureClock(elapsed),
    checkpointLabel:saved>0?formatCaptureClock(saved):null,
    memoryWarning,
    memoryPercent:memoryRatio===null?null:Math.min(100,Math.round(memoryRatio*100)),
    detail:checkpointError
      ? 'Recovery backup could not be updated. Finish and save your take to the cloud.'
      : memoryWarning
        ? 'Long recording nearing the phone capture memory limit. Press Finish and Save for PC to protect this take.'
        : saved>0
          ? 'Device recovery checkpoint saved. The most recent seconds may not be protected yet.'
          : 'Waiting for the first device recovery checkpoint. Keep Studio open.',
  };
}
