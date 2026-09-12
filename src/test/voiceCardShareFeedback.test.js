// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('voice card share feedback', () => {
  it('keeps user-cancel quiet but surfaces real share failures', async () => {
    const source = await readText('src/components/messages/VoiceCardDialog.jsx');

    expect(source).toContain('if (!res.ok) throw new Error(`Voice card fetch failed: ${res.status}`)');
    expect(source).toContain('if (error?.name !== "AbortError")');
    expect(source).toContain('toast.error("Couldn\'t share the voice card. Please try again.")');
  });
});
