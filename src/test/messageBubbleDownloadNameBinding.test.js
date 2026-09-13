// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('MessageBubble download response binding', () => {
  it('uses only the server-authorized non-empty filename', async () => {
    const source = await readFile('src/components/messages/MessageBubble.jsx', 'utf8');
    expect(source).toContain('const downloadName = auth?.data?.file_name;');
    expect(source).toContain('typeof downloadName !== "string"');
    expect(source).toContain('!downloadName.trim()');
    expect(source).toContain('resumableDownload(downloadUrl, downloadName');
    expect(source).not.toContain('auth?.data?.file_name || message.file_name || "file"');
  });
});
