import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('playlist dialog and milestone pagination', () => {
  it('loads all owned playlists in the add-to-playlist dialog', async () => {
    const s = await readFile('src/components/explore/AddToPlaylistDialog.jsx', 'utf8');
    expect(s).toContain('async function listAllOwnedPlaylists(userId)');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('listAllOwnedPlaylists(currentUser.id)');
  });

  it('loads all project milestones in Studio', async () => {
    const s = await readFile('src/components/studio/MilestonesPanel.jsx', 'utf8');
    expect(s).toContain('async function listAllProjectMilestones(projectId)');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('listAllProjectMilestones(projectId)');
  });
});
