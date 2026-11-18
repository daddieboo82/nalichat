import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Consistent device mic Studio Sound contract', () => {
  it('uses a shared, browser-portable microphone request in Studio and Messaging sessions', async () => {
    const studio = await readFile('src/pages/Studio.jsx', 'utf8');
    const messaging = await readFile('src/components/messages/ChatSessionViewer.jsx', 'utf8');
    expect(studio).toContain('await openStudioMicrophone(navigator.mediaDevices)');
    expect(messaging).toContain('await openStudioMicrophone(navigator.mediaDevices)');
    expect(studio).toContain('inspectSharedStudioCaptureSettings(');
    expect(messaging).toContain('inspectSharedStudioCaptureSettings(');
  });
  it('enables Studio Auto Polish by default while retaining user ON/OFF control', async () => {
    const studio = await readFile('src/pages/Studio.jsx', 'utf8');
    const processor = await readFile('src/lib/audioProcessing.js', 'utf8');
    expect(studio).toContain('const [autoPolishVocals, setAutoPolishVocals] = useState(true)');
    expect(studio).toContain('const toggleAutoPolishVocals = () =>');
    expect(studio).toContain('setVocalAutoPolish(current, true)');
    expect(processor).toContain("if (track?.autoPolish === true)");
    expect(processor).toContain('context.createDynamicsCompressor()');
  });
  it('does not silently enable voice-model training with studio microphone polish', async () => {
    const studio = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(studio).toContain('const [trainMyVoice, setTrainMyVoice] = useState(false)');
    expect(studio).toContain('shouldTrainNaliVoiceTake(');
  });
});
