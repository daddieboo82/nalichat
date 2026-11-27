// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('shared microphone selection synchronization', () => {
  it('shows the actual saved device even when it is temporarily absent from enumeration', async () => {
    const picker = await readFile('src/components/audio/MicrophoneInputPicker.jsx', 'utf8');
    expect(picker).toContain('value={selected}');
    expect(picker).toContain('!selectedAvailable && <option value={selected}>Saved microphone (currently unavailable)</option>');
    expect(picker).not.toContain('value={selectedAvailable ? selected : "default"}');
  });

  it('notifies Quick Record and other listeners when the mic changes in this tab or another tab', async () => {
    const picker = await readFile('src/components/audio/MicrophoneInputPicker.jsx', 'utf8');
    const devices = await readFile('src/hooks/useAudioDevices.js', 'utf8');
    const helper = await readFile('src/lib/microphoneCapture.js', 'utf8');
    expect(helper).toContain("export const MICROPHONE_SELECTION_EVENT = 'nalichat:microphone-selection-changed'");
    expect(picker).toContain('window.dispatchEvent(new Event(MICROPHONE_SELECTION_EVENT))');
    expect(devices).toContain('window.dispatchEvent(new Event(MICROPHONE_SELECTION_EVENT))');
    expect(picker).toContain('window.addEventListener("storage", handleStorageChanged)');
    expect(devices).toContain("window.addEventListener('storage', handleStorage)");
    expect(devices).toContain('window.addEventListener(MICROPHONE_SELECTION_EVENT, syncInputSelection)');
    expect(devices).toContain('window.removeEventListener(MICROPHONE_SELECTION_EVENT, syncInputSelection)');
  });

  it('uses the same disconnected-device fallback in the mic monitor and recorder', async () => {
    const monitor = await readFile('src/hooks/useMicMonitor.js', 'utf8');
    expect(monitor).toContain('await openPreferredMicrophone(navigator.mediaDevices, {');
    expect(monitor).toContain("deviceId: deviceId && deviceId !== 'default' ? deviceId : null");
  });
});
