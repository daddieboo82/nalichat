// Compare the session captured at Save with the latest committed session.
// Track identities are immutable by convention; all other save-relevant fields
// are compared as values/references. This prevents a stale PC handoff being
// advertised as current after tempo, key, title or FX changes during upload.
export function hasStudioSaveRevisionChanged(saved, current) {
  if (!saved || !current) return true;
  return saved.tracks !== current.tracks ||
    saved.projectName !== current.projectName ||
    saved.bpm !== current.bpm ||
    saved.songKey !== current.songKey ||
    saved.timeSignature !== current.timeSignature ||
    saved.masterFx !== current.masterFx ||
    saved.roomId !== current.roomId ||
    saved.userId !== current.userId;
}
