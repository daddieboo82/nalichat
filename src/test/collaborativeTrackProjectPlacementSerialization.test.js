// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('collaborative track project placement serialization', () => {
  it('locks real projects before track creation and keeps session tracks separate', async () => {
    const source = await readText('base44/functions/createCollaborativeTrack/entry.ts');

    expect(source).toContain('acquireProjectMembershipLock');
    expect(source).toContain('releaseProjectMembershipLock');
    expect(source).toContain('const initialProject = await entities.Project.get(projectId)');
    expect(source).toContain('Project is being updated. Please retry.');
    expect(source).toContain('Chat-session tracks use the parent Message ID');
    expect(source).toContain('waveform_data points must be numbers between -1 and 1');
    expect(source).not.toContain('.map((point: unknown) => Number(point))');
  });
});
