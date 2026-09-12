import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('project deletion identifier validation', () => {
  it('requires a canonical Base44 project id before service-role lookup', async () => {
    const source = await readFile('base44/functions/deleteProject/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(projectId.trim())');
    expect(source.indexOf('isBase44EntityId(projectId.trim())')).toBeLessThan(source.indexOf('entities.Project.get(projectId)'));
  });
});
