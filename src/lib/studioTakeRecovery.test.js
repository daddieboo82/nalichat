import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { studioRecoveryScope, saveStudioRecoveryTake } from './studioTakeRecovery';

describe('NaliChat device-only completed-take recovery', () => {
  it('isolates standalone and cloud-room projects', () => {
    expect(studioRecoveryScope(null)).toBe('draft');
    expect(studioRecoveryScope('6a1f5ee134147461560c2b37')).toBe('room:6a1f5ee134147461560c2b37');
    expect(() => studioRecoveryScope('../other-user')).toThrow();
  });
  it('rejects invalid records before opening storage', async () => {
    await expect(saveStudioRecoveryTake({
      ownerId:'valid-user-id',scope:'draft', audio:new Blob(['not audio'],{type:'text/plain'}),
      duration:10,id:'valid-id-1234',
    }, null)).rejects.toThrow(/cannot be stored/i);
    await expect(saveStudioRecoveryTake({
      ownerId:'valid-user-id',scope:'draft', audio:new Blob([], {type:'audio/wav'}),
      duration:10,id:'valid-id-1234',
    }, null)).rejects.toThrow();
    await expect(saveStudioRecoveryTake({
      ownerId:'valid-user-id',scope:'room:../bad', audio:new Blob(['abc'], {type:'audio/wav'}),
      duration:10,id:'valid-id-1234',
    }, null)).rejects.toThrow();
  });
  it('captures only completed mobile mic takes, never silences or MIDI alone', async () => {
    const studio = await readFile('src/pages/Studio.jsx','utf8');
    expect(studio).toContain('if (isMobile && trainingOwner && captureHadMicTrack)');
    expect(studio).toContain('await saveStudioRecoveryTake({');
    const capture = studio.indexOf('const blob = new Blob(stoppedChunks');
    const backup = studio.indexOf('await saveStudioRecoveryTake({');
    expect(backup).toBeGreaterThan(capture);
    expect(studio).toContain('const restoreMobileTake = async (record)');
    expect(studio).toContain('setTracksWithHistory(prev => [...prev,track])');
    expect(studio).toContain('audioUrl, file_url:audioUrl');
  });
  it('does not automatically upload recovered audio or treat it as voice-model consent', async () => {
    const code = await readFile('src/lib/studioTakeRecovery.js','utf8');
    expect(code).not.toContain('secureUploadFile(');
    expect(code).not.toContain('trainPrivateNaliVoiceFromRecording(');
    expect(code).not.toContain('base44.');
  });
});
