// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('ChatInput recording teardown', () => {
  it('detaches recorder callbacks before stopping on unmount', async () => {
    const source = await readText('src/components/messages/ChatInput.jsx');
    expect(source).toContain('const mountedRef = useRef(true);');
    expect(source).toContain('recorder.ondataavailable = null;');
    expect(source).toContain('recorder.onstop = null;');
    expect(source).toContain('if (!mountedRef.current)');
    expect(source).toContain('const mimeType = recorder.mimeType || "audio/webm";');
  });
});
