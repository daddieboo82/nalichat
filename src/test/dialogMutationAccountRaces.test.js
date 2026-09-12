// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('dialog mutation account races', () => {
  it('ignores playlist mutation completions from a previous account', async () => {
    const source = await readFile('src/components/explore/AddToPlaylistDialog.jsx', 'utf8');
    expect(source).toContain('const identityGenerationRef = useRef(0);');
    expect(source).toContain('identityGenerationRef.current += 1;');
    expect(source).toContain('generation !== identityGenerationRef.current');
    expect(source).toContain('if (result?.stale) return;');
  });

  it('ignores milestone mutations after account or project changes', async () => {
    const source = await readFile('src/components/studio/MilestonesPanel.jsx', 'utf8');
    expect(source).toContain('const mutationGenerationRef = useRef(0);');
    expect(source).toContain('mutationGenerationRef.current += 1;');
    expect(source).toContain('generation !== mutationGenerationRef.current');
  });

  it('ignores project settings mutations after the dialog context changes', async () => {
    const source = await readFile('src/components/studio/ProjectSettingsDialog.jsx', 'utf8');
    expect(source).toContain('const mutationGenerationRef = useRef(0);');
    expect(source).toContain('mutationGenerationRef.current += 1;');
    expect(source).toContain('stale: generation !== mutationGenerationRef.current');
    expect(source).toContain('if (generation !== mutationGenerationRef.current) return;');
  });
});
