import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { sessionTrackStart, sessionTrackLocalTime, sessionTrackShouldPlay, sessionTrackEnd, nextSessionTrackStart } from './sessionTrackTiming';

describe('remote session track alignment', () => {
  it('preserves old tracks at zero and honors persistent server offsets', () => {
    expect(sessionTrackStart({})).toBe(0);
    expect(sessionTrackStart({start_time: 0.65})).toBe(0.65);
    expect(sessionTrackStart({startTime: 0.3, start_time: 0.65})).toBe(0.3);
    expect(sessionTrackStart({start_time: -5})).toBe(0);
  });

  it('positions takes relative to session transport without rewriting PCM', () => {
    const track = { start_time: 1.25, duration: 3 };
    expect(sessionTrackShouldPlay(track, 0, 3)).toBe(false);
    expect(sessionTrackShouldPlay(track, 1.25, 3)).toBe(true);
    expect(sessionTrackLocalTime(track, 2)).toBeCloseTo(0.75);
    expect(sessionTrackShouldPlay(track, 4.25, 3)).toBe(false);
    expect(sessionTrackEnd(track, 3)).toBeCloseTo(4.25);
  });

  it('nudges take alignment in 50-ms steps with zero floor and no source edits', () => {
    const track = {start_time: 0.1, file_url: 'https://example.com/unchanged.wav'};
    expect(nextSessionTrackStart(track, 0.05)).toBeCloseTo(0.15);
    expect(nextSessionTrackStart(track, -0.05)).toBeCloseTo(0.05);
    expect(nextSessionTrackStart(track, -0.5)).toBe(0);
    expect(track.start_time).toBe(0.1);
    expect(track.file_url).toContain('unchanged.wav');
  });

  it('persists alignment on a private member-scoped server track and in mastering', async () => {
    const schema = JSON.parse(await readFile('base44/entities/Track.jsonc', 'utf8'));
    const creator = await readFile('base44/functions/createCollaborativeTrack/entry.ts', 'utf8');
    const mutation = await readFile('base44/functions/mutateTrack/entry.ts', 'utf8');
    const mastering = await readFile('src/lib/autoMaster.js', 'utf8');
    const viewer = await readFile('src/components/messages/ChatSessionViewer.jsx', 'utf8');
    expect(schema.properties.start_time.type).toBe('number');
    expect(creator).toContain('start_time: startTime');
    expect(mutation).toContain("'start_time'");
    expect(mutation).toContain("if (patch.start_time !== undefined)");
    expect(mastering).toContain('source.start(Math.max(0, track.startTime || 0))');
    expect(viewer).toContain('startTime: sessionTrackStart(track)');
  });
});
