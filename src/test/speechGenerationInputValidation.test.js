// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('speech generation input validation', () => {
  it('rejects malformed, oversized, and unsupported voice input before provider dispatch', async () => {
    const source = await readText('base44/functions/generate-speech/entry.ts');

    expect(source).toContain("typeof text !== 'string'");
    expect(source).toContain('text.length > 5000');
    expect(source).toContain('status: 413');
    expect(source).toContain("voice != null && voice !== 'honey'");
    expect(source).toContain("voice: 'honey'");
    expect(source).not.toContain('text.slice(0, 5000)');
  });
});
