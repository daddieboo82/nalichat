// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('voice message upload validation', () => {
  it('validates the recorded voice File before secure upload', async () => {
    const source = await readFile('src/components/messages/ChatInput.jsx', 'utf8');
    const voice = source.indexOf('const id = `voice-${Date.now()}`;');
    const validation = source.indexOf('validateUpload(file)', voice);
    const upload = source.indexOf('secureUploadFile({ file })', validation);
    expect(validation).toBeGreaterThan(voice);
    expect(upload).toBeGreaterThan(validation);
    expect(source).toContain('toast.error(validation.error)');
  });
});
