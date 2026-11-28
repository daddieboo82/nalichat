import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio delayed playback errors cannot stop a newer transport', () => {
  it('gives each Play/Pause command its own attempt ID and session epoch', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const start = source.indexOf('const togglePlay = async () => {');
    const end = source.indexOf('  useEffect(() => {\n    return () => {', start);
    const block = source.slice(start,end);
    expect(block).toContain('const playbackAttempt = ++playbackAttemptRef.current');
    expect(block).toContain('const playbackEpoch = historyEpochRef.current');
    expect(block).toContain('playbackAttemptRef.current !== playbackAttempt');
    expect(block).toContain('historyEpochRef.current !== playbackEpoch');
    expect(block.indexOf('playbackAttemptRef.current !== playbackAttempt')).toBeLessThan(block.indexOf('setIsPlaying(false);',block.indexOf('Promise.all(playPromises)')));
  });
  it('invalidates outstanding playback promises on Stop', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const stop = source.slice(source.indexOf('const stop = () => {'),source.indexOf('// Called when the count-in overlay'));
    expect(stop).toContain('playbackAttemptRef.current += 1');
  });
  it('invalidates playback starts while beginning a microphone capture', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const start = source.indexOf('if (isPlaying) {\n      playbackAttemptRef.current += 1;');
    const end = source.indexOf('const armedMidiOnly',start);
    expect(source.slice(start,end)).toContain('setIsPlaying(false)');
  });
});

it('captures the final recording latency before releasing spectral playback on Stop',async()=>{
 const source=await readFile('src/pages/Studio.jsx','utf8');const block=source.slice(source.indexOf('const stop = () => {'),source.indexOf('// Called when the count-in overlay'));expect(block.indexOf('stopRecordingProcess()')).toBeGreaterThanOrEqual(0);expect(block.indexOf('resetSpectralTransport()')).toBeGreaterThan(block.indexOf('stopRecordingProcess()'));
});
