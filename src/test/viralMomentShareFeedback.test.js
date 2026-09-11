// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('viral moment share feedback', () => {
  it('keeps user-cancel quiet but surfaces real share failures', async () => {
    const source = await readText('src/components/messages/ViralMomentDialog.jsx');

    expect(source).toContain('if (error?.name !== "AbortError")');
    expect(source).toContain('toast.error("Couldn\'t share this Viral Moment. Please try again.")');
    expect(source).toContain('await handleCopy();');
  });
});
