// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('invite link copy feedback', () => {
  it('only reports copied after clipboard success', async () => {
    const source = await readText('src/components/messages/InviteTab.jsx');

    expect(source).toContain('const copiedSuccessfully = await copyToClipboard(inviteLink);');
    expect(source).toContain('if (!copiedSuccessfully) {');
    expect(source).toContain('toast.error("Couldn\'t copy the invite link. Please copy it manually.")');
    expect(source.indexOf('setCopied(true);')).toBeGreaterThan(
      source.indexOf('if (!copiedSuccessfully) {'),
    );
  });
});
