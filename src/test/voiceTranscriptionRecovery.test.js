// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('voice transcription recovery', () => {
  it('shows retry UI and clears speaking state when TTS has no URL', async () => {
    const source = await readText('src/components/messages/VoiceTranscription.jsx');

    expect(source).toContain('const retryTranscription = () =>');
    expect(source).toContain('Transcription unavailable.');
    expect(source).toContain('Retry');
    expect(source).toContain('if (typeof url !== "string" || !url.trim()) throw new Error("Speech audio was unavailable.");');
    expect(source).toContain('setSpeaking(false);');
  });
});
