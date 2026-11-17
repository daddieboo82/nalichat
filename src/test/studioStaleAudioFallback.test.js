import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio cross-origin audio fallback safety', () => {
  it('does not replace a newer clip when an obsolete audio element fails', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const start = source.indexOf("audio.addEventListener('error', () => {");
    const end = source.indexOf("}, { once: true });", start);
    const fallback = source.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(fallback).toContain("audioElementsRef.current[track.id] !== audio");
    expect(fallback).toContain("audio.dataset.srcUrl !== track.audioUrl");
    expect(fallback.indexOf('audioElementsRef.current[track.id] !== audio'))
      .toBeLessThan(fallback.indexOf('mixEngineRef.current?.detach(track.id)'));
    expect(fallback.indexOf('audio.dataset.srcUrl !== track.audioUrl'))
      .toBeLessThan(fallback.indexOf('audioElementsRef.current[track.id] = plain'));
  });
});
