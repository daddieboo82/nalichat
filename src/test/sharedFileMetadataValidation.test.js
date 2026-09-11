// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('shared file metadata validation', () => {
  it('rejects malformed or oversized metadata instead of silently truncating it', async () => {
    const source = await readText('base44/functions/mutateSharedFile/entry.ts');

    expect(source).toContain("File name must be a string");
    expect(source).toContain('name.length > 255');
    expect(source).toContain("File description must be a string");
    expect(source).toContain('body.description.length > 1000');
    expect(source).toContain("tags must be an array");
    expect(source).toContain('body.tags.length > 50');
    expect(source).toContain('tag.trim().length > 64');
    expect(source).toContain("folderId must be a string or null");
    expect(source).not.toContain('slice(0, 255)');
    expect(source).not.toContain('slice(0, 1000)');
  });
});
