// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('call summary capture session binding', () => {
  it('keeps recorder chunks, timestamps, session IDs, and completion scoped to one capture', async () => {
    const source = await readText('src/hooks/useCallSummary.js');
    expect(source).toContain('const captureSessionId = data?.session?.id;');
    expect(source).toContain('const captureStartedAt = new Date().toISOString();');
    expect(source).toContain('const captureChunks = [];');
    expect(source).toContain('currentData?.session?.id !== captureSessionId');
    expect(source).toContain('session_id: captureSessionId');
    expect(source).toContain('capture_started_at: captureStartedAt');
    expect(source).toContain('let resolveUpload;');
    expect(source).not.toContain('completeUploadRef');
    expect(source).toContain('data?.session?.id,');
  });
});
