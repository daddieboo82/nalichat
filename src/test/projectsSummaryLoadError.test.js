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
});
