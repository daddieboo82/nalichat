import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('BounceDialog project metadata sync', () => {
  it('refreshes export title and genre when the dialog opens for the current project', async () => {
    const s = await readFile('src/components/studio/BounceDialog.jsx', 'utf8');
    expect(s).toContain('if (!open || bouncing) return;');
    expect(s).toContain('setBounceTitle(projectTitle || "Untitled");');
    expect(s).toContain('setBounceGenre(project?.genre || "");');
    expect(s).toContain('setError("");');
    expect(s).toContain('setDone(false);');
  });
});
