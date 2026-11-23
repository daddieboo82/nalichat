// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai background speech privacy', () => {
  it('does not request or start speech while the app is hidden', async () => {
    const source = await read();
    const speak = source.slice(source.indexOf('const speakText = async (text) => {'), source.indexOf('// Watch for new assistant messages'));
    expect(speak).toContain("if (document.visibilityState === 'hidden') return;");
    expect(speak.indexOf("if (document.visibilityState === 'hidden') return;")).toBeLessThan(speak.indexOf("base44.functions.invoke('generate-speech'"));
    expect(speak).toContain("if (generation !== speechGenerationRef.current || document.visibilityState === 'hidden') return;");
    expect(source).toContain("if (document.visibilityState === 'hidden') return;\n    const last = messages[messages.length - 1];");
  });
  it('pauses audible speech and invalidates delayed audio when backgrounded', async () => {
    const source = await read();
    const start = source.indexOf('const stopBackgroundSpeech = () => {');
    const end = source.indexOf('}, []);', start);
    const section = source.slice(start, end);
    expect(section).toContain("if (document.visibilityState !== 'hidden') return;");
    expect(section).toContain('speechGenerationRef.current += 1;');
    expect(section).toContain('currentAudioRef.current.pause();');
    expect(section).toContain('currentAudioRef.current = null;');
    expect(section).toContain('setIsSpeaking(false);');
    expect(section).toContain("document.addEventListener('visibilitychange', stopBackgroundSpeech)");
    expect(section).toContain("document.removeEventListener('visibilitychange', stopBackgroundSpeech)");
    expect(section).not.toContain('sendInFlightRef.current = false');
    expect(section).not.toContain('sendAgentText(');
  });
});
