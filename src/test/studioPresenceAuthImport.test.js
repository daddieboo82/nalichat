// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('studio presence auth import', () => {
  it('declares useAuth exactly once', async () => {
    const source = await readText('src/hooks/useStudioPresence.js');
    expect(source.match(/import \{ useAuth \} from '@\/lib\/AuthContext';/g) || []).toHaveLength(1);
  });
});
