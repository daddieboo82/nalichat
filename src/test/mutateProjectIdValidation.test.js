import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('project mutation id validation', () => {
  it('validates the project id before privileged lookup', async () => {
    const s = await readFile('base44/functions/mutateProject/entry.ts', 'utf8');
    expect(s.indexOf('isBase44EntityId(projectId)')).toBeLessThan(s.indexOf('entities.Project.get(projectId)'));
  });
});
