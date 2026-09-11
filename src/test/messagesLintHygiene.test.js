// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Messages page lint hygiene', () => {
  it('does not keep known-unused imports that fail eslint', async () => {
    const source = await readText('src/pages/Messages.jsx');

    expect(source).not.toContain('from "@/hooks/use-sound"');
    expect(source).not.toContain('createTempId');
    expect(source).not.toContain('applyRealtimeCreate');
    expect(source).toContain('createClientMessageKey');
    expect(source).toContain('applySendSuccess');
    expect(source).toContain('applySendFailure');
  });
});
