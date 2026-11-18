import { describe, it, expect } from 'vitest';
import { selectReconstructionTrack } from './studioReconstructionSelection';

describe('AI Reconstruct track selection', () => {
  const tracks = [
    { id: 1, name: 'Audio 1', type: 'audio', audioUrl: 'blob:generic-recording' },
    { id: 2, name: 'Vocals', type: 'audio', audioUrl: 'blob:vocal' },
    { id: 3, name: 'Empty Audio', type: 'audio' },
    { id: 4, name: 'Vocal Synth', type: 'instrument', instrument: 'synth', audioUrl: 'blob:synth' },
  ];

  it('opens for a selected ordinary audio track without a vocal name', () => {
    expect(selectReconstructionTrack(tracks, [1])?.audioUrl).toBe('blob:generic-recording');
  });
  it('also supports recorded vocal tracks', () => {
    expect(selectReconstructionTrack(tracks, [2])?.name).toBe('Vocals');
  });
  it('does not select blank tracks or instrument clips', () => {
    expect(selectReconstructionTrack(tracks, [3])).toBeNull();
    expect(selectReconstructionTrack(tracks, [4])).toBeNull();
  });
  it('handles numeric and string track IDs', () => {
    expect(selectReconstructionTrack(tracks, ['1'])?.id).toBe(1);
  });
});
