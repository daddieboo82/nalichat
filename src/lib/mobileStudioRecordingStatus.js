// NaliChat mobile recording status is derived from actual recorder state and
// durable track URLs. A blob: take survives only while this browser document
// stays open; it must never be described as cloud-saved.
export function getMobileStudioRecordingStatus({
  recording = false, micPending = false, finalizing = false,
  saving = false, tracks = [], visible = true,
} = {}) {
  if (finalizing) return { level: 'working', label: 'Finishing your take…', detail: 'Keep Studio open until your waveform appears.' };
  if (micPending) return { level: 'working', label: 'Connecting microphone…', detail: 'Allow microphone access to begin recording.' };
  if (recording && !visible) return { level: 'warning', label: 'Phone is in the background', detail: 'Mobile browsers may suspend microphone capture. Return to Studio before continuing.' };
  if (recording) return { level: 'recording', label: 'Microphone is recording', detail: 'Keep this page open. Press Finish before switching apps.' };
  if (saving) return { level: 'working', label: 'Saving to NaliChat…', detail: 'Keep Studio open until the cloud save finishes.' };
  const unsaved = tracks.some(track => [track?.audioUrl, track?.file_url,
    ...(Array.isArray(track?.playlists) ? track.playlists.flatMap(t => [t?.audioUrl, t?.file_url]) : [])]
    .some(url => typeof url === 'string' && url.startsWith('blob:')));
  if (unsaved) return { level: 'warning', label: 'Audio captured — save before leaving', detail: 'This take is only in the current browser tab. Use Save for PC in Tools to upload it.' };
  return { level: 'ready', label: 'Ready to record', detail: 'Use headphones for cleaner takes. Your saved sessions can be opened on PC.' };
}
