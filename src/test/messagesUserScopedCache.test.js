// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Messages user-scoped caches', () => {
  it('isolates conversation and message caches by active user', async () => {
    const source = await readText('src/pages/Messages.jsx');

    expect(source).toContain('queryKey: ["conversations", currentUser?.id]');
    expect(source).toContain('queryKey: ["messages", currentUser?.id, selectedConvId]');
    expect(source).toContain('enabled: !!currentUser?.id');
    expect(source).toContain('}, [currentUser?.id]);');
    expect(source).not.toContain('queryKey: ["conversations"]');
    expect(source).not.toContain('queryKey: ["messages", selectedConvId]');
  });
});
