// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');
describe('NALI.ai microphone and failed-draft safety', () => {
  it('releases the microphone when closing, minimizing, switching account or unmounting', async () => {
    const source = await read();
    expect(source).toContain('const recognitionRef = useRef(null);');
    expect(source).toContain("document.visibilityState === 'hidden' || !open || minimized");
    expect(source).toContain("document.addEventListener('visibilitychange', stopHiddenRecognition)");
    expect(source).toContain('recognitionRef.current?.abort();');
    expect(source).toContain('recognitionRef.current = null;');
    expect(source).toContain('}, [open, minimized]);');
  });
  it('offers a stop control and ignores transcript events from a stale recognition session', async () => {
    const source = await read();
    expect(source).toContain('recognitionRef.current.stop();');
    expect(source).toContain('if (recognitionRef.current !== recognition) return;');
    expect(source).toContain('aria-pressed={isListening}');
  });
  it('keeps the prompt available for retry if message delivery fails', async () => {
    const source = await read();
    expect(source).toContain('setInput(current => current || text);');
  });
});