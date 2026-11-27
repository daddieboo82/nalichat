// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('mobile and desktop microphone integration', () => {
  it('routes all core recording surfaces through the preferred input handler', async () => {
    const paths = [
      'src/pages/Record.jsx',
      'src/components/messages/ChatInput.jsx',
      'src/pages/LiveBattles.jsx',
      'src/components/record/RecordingGuide.jsx',
      'src/lib/callEngine.js',
    ];
    for (const path of paths) {
      const code = await readFile(path, 'utf8');
      expect(code, path).toContain('openPreferredMicrophone(');
    }
    const studio = await readFile('src/lib/sharedStudioCapture.js', 'utf8');
    expect(studio).toContain('openPreferredMicrophone(mediaDevices, { audio, deviceId })');
    const studioPage = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(studioPage).toContain('await openStudioMicrophone(navigator.mediaDevices)');
    const sessions = await readFile('src/components/messages/ChatSessionViewer.jsx', 'utf8');
    expect(sessions).toContain('await openStudioMicrophone(navigator.mediaDevices)');
  });

  it('offers an explicit, permission-safe microphone picker in Help & Support', async () => {
    const help = await readFile('src/components/GlobalHelpDialog.jsx', 'utf8');
    const picker = await readFile('src/components/audio/MicrophoneInputPicker.jsx', 'utf8');
    expect(help).toContain('<MicrophoneInputPicker />');
    expect(picker).toContain('onClick={() => { void enableAndRefresh(); }}');
    expect(picker).toContain('stream?.getTracks?.().forEach(track => track.stop());');
    expect(picker).toContain('localStorage.setItem("audioInputDevice", value)');
    expect(picker).toContain('navigator.mediaDevices?.addEventListener?.("devicechange"');
  });
});
