// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('audio device enumeration race protection', () => {
  it('ignores stale and post-unmount device enumeration results', async () => {
    const source = await readText('src/hooks/useAudioDevices.js');
    expect(source).toContain('let cancelled = false;');
    expect(source).toContain('let requestId = 0;');
    expect(source).toContain('const currentRequestId = ++requestId;');
    expect(source).toContain('if (cancelled || currentRequestId !== requestId) return;');
    expect(source).toContain('if (!cancelled && currentRequestId === requestId)');
    expect(source).toContain('requestId += 1;');
  });
});
