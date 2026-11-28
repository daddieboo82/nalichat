// Object-backed player IDs stringify; Map and Set keys do not.
export function releaseStudioAudioPlayer({ players, id, expected, starting, failed, engine }) {
  const player = players[id];
  if (!player || (expected && player !== expected)) return false;
  delete players[id];
  const keys = new Set([id, String(id)]);
  const numeric = Number(id);
  if (Number.isFinite(numeric) && String(numeric) === String(id)) keys.add(numeric);
  for (const key of keys) {
    starting?.delete(key);
    failed?.delete(key);
    try { engine?.detach(key); } catch { /* continue releasing media */ }
  }
  try { player.pause(); } catch { /* best effort */ }
  try { player.removeAttribute('src'); } catch { /* best effort */ }
  try { player.load(); } catch { /* best effort */ }
  return true;
}
