import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { getMobileStudioRecordingStatus } from './mobileStudioRecordingStatus';

describe('mobile Studio recording interruption and cloud-save messaging', () => {
  it('never describes a transient blob as cloud-saved', () => {
    const status = getMobileStudioRecordingStatus({
      tracks: [{ id: 1, audioUrl: 'blob:local-recorded-take' }],
    });
    expect(status.level).toBe('warning');
    expect(status.label).toMatch(/save before leaving/i);
    expect(status.detail).toMatch(/browser tab/i);
  });
  it('checks alternate takes and ignores durable URLs', () => {
    const withTake = getMobileStudioRecordingStatus({
      tracks: [{file_url: 'https://nalichat.org/audio.wav', playlists: [{audioUrl: 'blob:alternate'}]}],
    });
    expect(withTake.level).toBe('warning');
    const saved = getMobileStudioRecordingStatus({
      tracks: [{file_url: 'https://nalichat.org/audio.wav'}],
    });
    expect(saved.level).toBe('ready');
  });
  it('warns that phone backgrounding may interrupt recording', () => {
    expect(getMobileStudioRecordingStatus({recording:true,visible:false}).label).toMatch(/background/i);
    expect(getMobileStudioRecordingStatus({recording:true,visible:true}).level).toBe('recording');
  });
  it('shows finalization and cloud save as distinct states', () => {
    expect(getMobileStudioRecordingStatus({finalizing:true,recording:true}).label).toMatch(/Finishing/i);
    expect(getMobileStudioRecordingStatus({saving:true}).label).toMatch(/Saving/i);
    expect(getMobileStudioRecordingStatus({micPending:true}).label).toMatch(/microphone/i);
  });
  it('finishes an interrupted microphone take only for its active recorder', async () => {
    const studio = await readFile('src/pages/Studio.jsx','utf8');
    expect(studio).toContain('micAudioTrack.onended = () =>');
    expect(studio).toContain('mediaRecorderRef.current !== mediaRecorder');
    expect(studio).toContain('recordingFinalizeInFlightRef.current');
    expect(studio).toContain('stopRecordingProcess();');
    expect(studio).toContain('setMobileTakeFinalizing(true)');
    expect(studio).toContain('setMobileTakeFinalizing(false)');
    expect(studio).toContain('document.addEventListener(\'visibilitychange\', updateVisibility)');
  });
});
