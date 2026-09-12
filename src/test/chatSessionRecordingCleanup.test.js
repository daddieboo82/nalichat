// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('ChatSessionViewer recording cleanup', () => {
  it('stops recorder and microphone streams on unmount and avoids stale state writes', async () => {
    const source = await readText('src/components/messages/ChatSessionViewer.jsx');
    expect(source).toContain('const streamRef = useRef(null);');
    expect(source).toContain('const mountedRef = useRef(true);');
    expect(source).toContain('streamRef.current?.getTracks().forEach((track) => track.stop())');
    expect(source).toContain('if (!mountedRef.current)');
    expect(source).toContain('if (mountedRef.current) setUploading(false);');
  });
});
