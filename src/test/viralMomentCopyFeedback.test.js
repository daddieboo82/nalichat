// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('viral moment copy feedback', () => {
  it('only reports copy success when the clipboard helper succeeds', async () => {
    const source = await readText('src/components/messages/ViralMomentDialog.jsx');

    expect(source).toContain('const copied = await copyToClipboard(buildShareText());');
    expect(source).toContain('if (copied) {');
    expect(source).toContain('toast.success("Copied to clipboard!")');
    expect(source).toContain('toast.error("Couldn\'t copy the script. Please copy it manually.")');
  });
});
