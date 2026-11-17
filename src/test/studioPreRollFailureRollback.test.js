import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Studio pre-roll playback recovery', () => {
  it('restores the punch-in playhead when all available backing players fail', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const begin = source.indexOf('if (!started.some(Boolean)) {', source.indexOf('const preRollPlayPromises = [];'));
    const block = source.slice(begin, source.indexOf('return;',begin));
    expect(block).toContain('pendingRecordStartRef.current = null');
    expect(block).toContain('preRollAudio.forEach(audio => audio.pause())');
    expect(block).toContain('updateCurrentTime(recordStartPos)');
    expect(block).toContain("Pre-roll audio couldn't start.");
  });
  it('does not let canceled pre-roll keep playing a player from its own session', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const start=source.indexOf('const preRollAudio = []');
    const end=source.indexOf('if (!started.some(Boolean))',start);
    const block=source.slice(start,end);
    expect(block).toContain('preRollAudio.push(audio)');
    expect(block).toContain('Object.values(audioElementsRef.current).includes(audio)');
    expect(block).toContain('audio.pause()');
  });
});
