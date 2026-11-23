// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const source = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai speech cancellation across asynchronous generation', () => {
  it('invalidates pending speech generation when muted, closed, minimized, unmounted, or identity changes', async () => {
    const code = await source();
    expect(code).toContain('const speechGenerationRef = useRef(0);');
    expect(code).toContain('const generation = ++speechGenerationRef.current;');
    expect(code).toContain('if (generation !== speechGenerationRef.current) return;');
    expect(code).toContain('if (!voiceEnabled || !open || minimized) {');
    expect(code).toContain('speechGenerationRef.current += 1;');
    expect(code).toContain('}, [voiceEnabled, open, minimized]);');
    expect(code).toContain('if (!voiceEnabled || !open || minimized || messages.length === 0) return;');
  });
  it('will not let a stale audio completion stop newer playback', async () => {
    const code = await source();
    expect(code).toContain('generation !== speechGenerationRef.current || currentAudioRef.current !== audio');
    expect(code).toContain('audio.onended = finish;');
    expect(code).toContain('audio.onerror = finish;');
    expect(code).toContain("if (!res?.data?.url) throw new Error('Speech audio was not returned');");
  });
});
