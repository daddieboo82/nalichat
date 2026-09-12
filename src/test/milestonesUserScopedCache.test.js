// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Milestones user-scoped cache', () => {
  it('isolates project milestones by authenticated user', async () => {
    const source = await readText('src/components/studio/MilestonesPanel.jsx');

    expect(source).toContain('const { user: currentUser } = useAuth();');
    expect(source).toContain('queryKey: ["milestones", currentUser?.id, projectId]');
    expect(source).toContain('enabled: !!currentUser?.id && !!projectId');
    expect(source).not.toContain('queryKey: ["milestones", projectId]');
  });
});
