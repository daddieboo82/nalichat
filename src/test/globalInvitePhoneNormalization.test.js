// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('GlobalInviteDialog SMS abuse protection', () => {
  it('normalizes the phone and opens the local SMS client', async () => {
    const source = await readText('src/components/GlobalInviteDialog.jsx');
    expect(source).toContain('const normalized = trimmed.replace(/[\\s()-]/g, "");');
    expect(source).toContain('window.location.href = `sms:');
    expect(source).not.toContain('base44.functions.invoke("sendSmsInvite"');
  });
});
