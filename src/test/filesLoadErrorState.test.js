import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Files load failures', () => {
  it('does not render query failures as an empty account', async () => {
    const s = await readFile('src/pages/Files.jsx', 'utf8');
    expect(s).toContain('isError: filesError');
    expect(s).toContain('isError: projectsError');
    expect(s).toContain('isError: foldersError');
    expect(s).toContain("Couldn't load your files");
    expect(s).toContain('onClick={() => void handleRefresh()}');
  });
});
