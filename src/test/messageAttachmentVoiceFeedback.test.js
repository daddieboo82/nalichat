// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('message attachment and voice feedback', () => {
  it('surfaces download and recording failures to the user', async () => {
    const bubble = await readText('src/components/messages/MessageBubble.jsx');
    const viewer = await readText('src/components/messages/MediaViewer.jsx');
    const input = await readText('src/components/messages/ChatInput.jsx');

    expect(bubble).toContain('toast.error(error?.message || "Couldn\'t download the attachment. Please try again.")');
    expect(viewer).toContain('toast.error(error?.message || "Couldn\'t download the attachment. Please try again.")');
    expect(input).toContain('toast.error("Voice recording isn\'t supported on this device or browser.")');
    expect(input).toContain('toast.error("Microphone access was denied or unavailable.")');
    expect(input).toContain('toast.error("Couldn\'t start voice recording. Please try again.")');
    expect(input).toContain('toast.error(error?.message || "Couldn\'t upload the voice message. Please try again.")');
  });
});
