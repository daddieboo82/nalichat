// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('ChatInput stale upload sends', () => {
  it('does not send a file after its composer unmounts', async () => {
    const source = await readFile('src/components/messages/ChatInput.jsx', 'utf8');
    expect(source).toContain('file_url = await resumableUpload(file, updateProgress);\n      if (!mountedRef.current) return;');
  });

  it('does not send a voice upload after its composer unmounts', async () => {
    const source = await readFile('src/components/messages/ChatInput.jsx', 'utf8');
    expect(source).toContain('const { file_url } = await secureUploadFile({ file });\n        if (!mountedRef.current) return;');
    expect(source.match(/if \(!mountedRef\.current\) return;/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
