// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('voice transcription TTS recovery', () => {
  it('handles structured errors, playback failures, and active audio cleanup', async () => {
    const source = await readText('src/components/messages/VoiceTranscription.jsx');

    expect(source).toContain('const audioRef = useRef(null);');
    expect(source).toContain('if (res?.data?.error) throw new Error(res.data.error);');
    expect(source).toContain('audioRef.current?.pause?.();');
    expect(source).toContain('toast.error("Couldn\'t play the transcription audio.")');
    expect(source).toContain('toast.error(error?.message || "Couldn\'t read the transcription aloud.")');
  });
});
