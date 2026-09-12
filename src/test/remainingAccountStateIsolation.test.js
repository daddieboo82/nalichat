// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('remaining account-state isolation', () => {
  it('clears global message drafts and scopes discovery cache by user', async () => {
    const source = await readFile('src/components/GlobalMessageDialog.jsx', 'utf8');
    expect(source).toContain('queryKey: ["users-list", currentUser?.id]');
    expect(source).toContain('setSelectedUser(null);');
    expect(source).toContain('setMessage("");');
    expect(source).toContain('retryKeyRef.current = null;');
    expect(source).toContain('const identityGenerationRef = useRef(0);');
    expect(source).toContain('if (identityGeneration !== identityGenerationRef.current) return;');
    expect(source).toContain('}, [currentUser?.id, onOpenChange]);');
  });

  it('stops playlist playback when the active identity changes', async () => {
    const source = await readFile('src/pages/PlaylistDetail.jsx', 'utf8');
    expect(source).toContain('audioRef.current.pause();');
    expect(source).toContain('audioRef.current.currentTime = 0;');
    expect(source).toContain('}, [playlistId, currentUser?.id]);');
  });

  it('clears challenge files and form drafts on account changes', async () => {
    const source = await readFile('src/pages/CreateChallenge.jsx', 'utf8');
    expect(source).toContain('setSourceTrackFile(null);');
    expect(source).toContain('setCoverFile(null);');
    expect(source).toContain('setCoverPreview(null);');
    expect(source).toContain('const identityGenerationRef = useRef(0);');
    expect(source).toContain('if (identityGeneration !== identityGenerationRef.current) return;');
    expect(source).toContain('}, [user?.id]);');
  });
});
