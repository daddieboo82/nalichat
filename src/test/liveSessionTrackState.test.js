// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('live session track state', () => {
  it('updates local tracks after create, update, and delete and reports failures', async () => {
    const source = await readText('src/components/messages/ChatSessionViewer.jsx');

    expect(source).toContain('setTracks((current) => [');
    expect(source).toContain('track.id === id ? { ...track, ...updated } : track');
    expect(source).toContain('current.filter((track) => track.id !== id)');
    expect(source).toContain('toast.error("Couldn\'t add the recorded track. Please try again.")');
    expect(source).toContain('toast.error("Couldn\'t update the track. Please try again.")');
    expect(source).toContain('toast.error("Couldn\'t delete the track. Please try again.")');
    expect(source).toContain('toast.error("Couldn\'t start recording. Check microphone access and try again.")');
  });
});
