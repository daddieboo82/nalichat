// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('ChatInput upload timer cleanup', () => {
  it('tracks and clears delayed upload-row removal timers', async () => {
    const source = await readText('src/components/messages/ChatInput.jsx');
    expect(source).toContain('const uploadRemovalTimersRef = useRef(new Set());');
    expect(source).toContain('uploadRemovalTimersRef.current.forEach((timer) => clearTimeout(timer));');
    expect(source).toContain('const scheduleUploadRemoval = (id, delayMs) => {');
    expect(source).toContain('if (mountedRef.current)');
  });
});
