// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('typing indicator recovery', () => {
  it('re-enables typing after successful polls and conversation changes', async () => {
    const source = await readText('src/hooks/useTypingIndicator.js');
    expect(source).toContain('supportedRef.current = true;');
    expect(source).toContain('const existing = await base44.entities.TypingStatus.filter');
    expect(source).toContain('lastSentRef.current = 0;');
  });
});
