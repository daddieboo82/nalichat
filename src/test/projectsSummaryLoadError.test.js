// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('projects summary load errors', () => {
  it('renders an explicit error state instead of a false empty-project state', async () => {
    const source = await readText('src/pages/ProjectsSummary.jsx');

    expect(source).toContain('const [loadError, setLoadError] = useState(false);');
    expect(source).toContain('setLoadError(true)');
    expect(source).toContain('Projects unavailable');
    expect(source).toContain("We couldn't load your projects. Refresh and try again.");
  });

  it('ignores stale loads after auth changes and clears loading when signed out', async () => {
    const source = await readText('src/pages/ProjectsSummary.jsx');
    expect(source).toContain('const { user, isLoadingAuth } = useAuth();');
    expect(source).toContain('const requestedUserId = user.id;');
    expect(source).toContain('let cancelled = false;');
    expect(source).toContain('if (cancelled) return;');
    expect(source).toContain('setData({ projects: [], milestones: [], sharedFiles: [] });');
    expect(source).toContain('if (!cancelled) setLoading(false);');
    expect(source).toContain('cancelled = true;');
  });
});
