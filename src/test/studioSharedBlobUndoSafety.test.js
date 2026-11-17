import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const studio = () => readFile('src/pages/Studio.jsx', 'utf8');
const span = (s, start, end) => s.slice(s.indexOf(start), s.indexOf(end,s.indexOf(start)));

describe('Studio split clip temporary audio lifetime', () => {
  it('never revokes a shared blob when one split track is deleted', async () => {
    const s = await studio();
    const b = span(s,'const deleteTrack = (trackId) => {', 'const duplicateTrack = (track) => {');
    expect(b).toContain('setTracksWithHistory(prev => prev.filter(t => t.id !== trackId))');
    expect(b).not.toContain('URL.revokeObjectURL');
  });
  it('preserves source audio during instrument rendering for Undo/Redo', async () => {
    const s = await studio();
    const b = span(s,'const handleRenderInstrument =', 'const addVcaTrack =');
    expect(b).not.toContain('URL.revokeObjectURL');
  });
  it('does not revoke sources when AudioSuite or Track Commit replace a clip', async () => {
    const s = await studio();
    const a = span(s,'<AudioSuiteDialog', '<FadePresetsDialog');
    const b = span(s,'<TrackCommitDialog', '{/* Mobile bottom bar');
    expect(a).not.toContain('URL.revokeObjectURL');
    expect(b).not.toContain('URL.revokeObjectURL');
  });
  it('keeps cleanup for genuinely unreferenced demo media', async () => {
    const s = await studio();
    expect(s).toContain('historyRef.current.forEach(retainTrackAudio)');
    expect(s).toContain('!retained.has(url)');
    expect(s).toContain('URL.revokeObjectURL(url)');
  });
});
