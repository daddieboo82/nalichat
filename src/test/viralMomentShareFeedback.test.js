// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('viral moment share feedback', () => {
  it('handles canvas encoding failures before creating a download URL', async () => {
    const source = await readText('src/components/messages/ViralMomentDialog.jsx');

    expect(source).toContain('if (!blob) {');
    expect(source).toContain('toast.error("Couldn\'t prepare the meme download. Please try again.")');
    expect(source.indexOf('if (!blob) {')).toBeLessThan(source.indexOf('URL.createObjectURL(blob)'));
  });

  it('keeps user-cancel quiet but surfaces real share failures', async () => {
    const source = await readText('src/components/messages/ViralMomentDialog.jsx');

    expect(source).toContain('if (!res.ok) throw new Error(`Meme fetch failed: ${res.status}`)');
    expect(source).toContain('if (error?.name !== "AbortError")');
    expect(source).toContain('toast.error("Couldn\'t share this Viral Moment. Please try again.")');
    expect(source).toContain('await handleCopy();');
  });
});
