import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('shared Studio project load state', () => {
  it('does not expose the blank-session welcome while a shared project is loading or failed', async () => {
    const s = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(s).toContain('const [projectLoading, setProjectLoading] = useState(Boolean(roomId));');
    expect(s).toContain('const [projectLoadError, setProjectLoadError] = useState(false);');
    expect(s).toContain('if (roomId && projectLoading) return (');
    expect(s).toContain('Studio project unavailable');
    expect(s).toContain("won't open a blank session in its place");
    expect(s).toContain('setProjectLoadRetryKey((key) => key + 1)');
  });
});
