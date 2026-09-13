// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio project save field confirmation', () => {
  it('reports success only after every requested project field is confirmed', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(source).toContain('const expectedUpdatedFields = ["bpm", "key", "master_fx", "studio_state", "title"]');
    expect(source).toContain('!Array.isArray(saved?.data?.updatedFields)');
    expect(source).toContain('!expectedUpdatedFields.every((field) => saved.data.updatedFields.includes(field))');
    expect(source).toContain('Project save was not confirmed.');
  });
});
