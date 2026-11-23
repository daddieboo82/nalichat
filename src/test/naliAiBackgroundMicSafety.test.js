// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const source = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai mobile microphone privacy', () => {
  it('stops dictation when the page is hidden without canceling pending AI replies', async () => {
    const code = await source();
    const start = code.indexOf('const stopHiddenRecognition = () => {');
    const end = code.indexOf('}, [open, minimized]);', start);
    const effect = code.slice(start, end);
    expect(effect).toContain("document.visibilityState === 'hidden' || !open || minimized");
    expect(effect).toContain('recognitionRef.current = null;');
    expect(effect).toContain('recognition.abort();');
    expect(effect).toContain('setIsListening(false);');
    expect(effect).toContain("document.addEventListener('visibilitychange', stopHiddenRecognition)");
    expect(effect).toContain("document.removeEventListener('visibilitychange', stopHiddenRecognition)");
    expect(effect).not.toContain('sendInFlightRef.current = false');
  });
  it('ignores late microphone activation after recognition was aborted', async () => {
    const code = await source();
    expect(code).toContain('recognition.onstart = () => {\n      if (recognitionRef.current !== recognition) return;\n      setIsListening(true);');
    expect(code).toContain('recognition.onresult = (event) => {\n      if (recognitionRef.current !== recognition) return;');
  });
});
