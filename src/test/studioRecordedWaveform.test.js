import { describe, expect, it } from 'vitest';
import { studioRecordedWaveform } from '../lib/studioRecordedWaveform.js';
import { readFile } from 'node:fs/promises';

function buffer(channels) {
  return { length: channels[0].length, numberOfChannels: channels.length,
    getChannelData(index) { return Float32Array.from(channels[index]); } };
}
describe('recorded take waveform accurately reflects measured samples', () => {
  it('preserves exact per-window peak amplitudes without inventing activity', () => {
    expect(studioRecordedWaveform(buffer([[0, 0.25, -0.5, 0, 0, 0.75, 0, -1]]), 4))
      .toEqual([0.25, 0.5, 0.75, 1]);
  });
  it('preserves silence instead of drawing artificial peaks', () => {
    expect(studioRecordedWaveform(buffer([[0, 0, 0, 0]]), 4)).toEqual([0, 0, 0, 0]);
  });
  it('includes transient peaks from every channel', () => {
    expect(studioRecordedWaveform(buffer([[0, 0, 0, 0], [0.7, 0, -0.3, 0]]), 2))
      .toEqual([expect.closeTo(0.7), expect.closeTo(0.3)]);
  });
  it('handles fewer samples than display points and invalid input', () => {
    expect(studioRecordedWaveform(buffer([[0.4]]), 3)).toEqual([expect.closeTo(0.4), expect.closeTo(0.4), expect.closeTo(0.4)]);
    expect(studioRecordedWaveform(null, 50)).toEqual([]);
    expect(studioRecordedWaveform(buffer([[0]]), -1)).toEqual([]);
  });
  it('never substitutes random waveform samples when browser decoding fails', async () => {
    const source = await readFile('src/pages/Studio.jsx','utf8');
    const from = source.indexOf('const audioUrl = URL.createObjectURL(blob);');
    const to = source.indexOf('const stopBeat = stoppedEndTime',from);
    const block = source.slice(from,to);
    expect(block).toContain('let realWaveform = []');
    expect(block).toContain('studioRecordedWaveform(audioBuffer, WAVEFORM_POINTS)');
    expect(block).toContain('waveformUnavailable = true');
    expect(block).not.toContain('generateWaveform(WAVEFORM_POINTS)');
  });
});
