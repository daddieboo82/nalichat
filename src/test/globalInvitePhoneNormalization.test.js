// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('GlobalInviteDialog SMS normalization', () => {
  it('sends the normalized phone value after validation', async () => {
    const source = await readText('src/components/GlobalInviteDialog.jsx');
    expect(source).toContain('const normalized = trimmed.replace(/[\\s()-]/g, "");');
    expect(source).toContain('base44.functions.invoke("sendSmsInvite", { phone: normalized })');
    expect(source).not.toContain('base44.functions.invoke("sendSmsInvite", { phone: phone.trim() })');
  });
});
