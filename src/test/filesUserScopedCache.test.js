// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Files user-scoped caches', () => {
  it('isolates shared-file and project query caches by active user', async () => {
    const source = await readText('src/pages/Files.jsx');
    expect(source).toContain('queryKey: ["shared-files", currentUser?.id]');
    expect(source).toContain('queryKey: ["projects", currentUser?.id]');
    expect(source).toContain('queryKey: ["folders", currentUser?.id]');
    expect(source).toContain('enabled: !!currentUser?.id');
    expect(source).toContain('await queryClient.cancelQueries({ queryKey: sharedFilesQueryKey });');
    expect(source).toContain('queryClient.setQueryData(sharedFilesQueryKey');
  });
});
