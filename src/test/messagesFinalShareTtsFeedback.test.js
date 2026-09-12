// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('final Messages share and TTS feedback', () => {
  it('only reports invite copy success after the clipboard succeeds', async () => {
    const source = await readText('src/components/GlobalInviteDialog.jsx');
    expect(source).toContain('const copiedSuccessfully = await copyToClipboard(inviteUrl);');
    expect(source).toContain('if (!copiedSuccessfully) {');
    expect(source).toContain('title: "Copy failed"');
  });

  it('keeps native-share cancellation quiet but surfaces real failures', async () => {
    const source = await readText('src/components/GlobalInviteDialog.jsx');
    expect(source).toContain('if (err?.name !== "AbortError")');
    expect(source).toContain('title: "Share failed"');
  });

  it('surfaces structured TTS generation and playback failures', async () => {
    const source = await readText('src/components/messages/MessageBubble.jsx');
    expect(source).toContain('if (res?.data?.error) throw new Error(res.data.error);');
    expect(source).toContain('Speech audio was not generated');
    expect(source).toContain("Couldn't play this message aloud. Please try again.");
  });
});
