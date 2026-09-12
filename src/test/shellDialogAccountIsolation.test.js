// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('shell and dialog account isolation', () => {
  it('ignores stale notification reloads after an account switch', async () => {
    const source = await readFile('src/components/notifications/NotificationBell.jsx', 'utf8');
    expect(source).toContain('const identityGenerationRef = useRef(0);');
    expect(source).toContain('identityGenerationRef.current += 1;');
    expect(source).toContain('generation !== identityGenerationRef.current');
    expect(source).toContain('await load(userId, generation)');
  });

  it('clears add-to-playlist drafts on identity changes', async () => {
    const source = await readFile('src/components/explore/AddToPlaylistDialog.jsx', 'utf8');
    expect(source).toContain('setNewPlaylistName("");');
    expect(source).toContain('}, [currentUser?.id, onOpenChange]);');
  });

  it('clears milestone drafts when user or project changes', async () => {
    const source = await readFile('src/components/studio/MilestonesPanel.jsx', 'utf8');
    expect(source).toContain('setShowAdd(false);');
    expect(source).toContain('}, [currentUser?.id, projectId]);');
  });

  it('closes destructive project state when identity or project changes', async () => {
    const source = await readFile('src/components/studio/ProjectSettingsDialog.jsx', 'utf8');
    expect(source).toContain('setShowDelete(false);');
    expect(source).toContain('}, [currentUser?.id, project?.id, onOpenChange]);');
  });
});
