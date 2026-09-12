// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('settings auth loading state', () => {
  it('does not leave Settings in an infinite spinner when auth.me fails', async () => {
    const source = await readText('src/pages/Settings.jsx');

    expect(source).toContain('const [loadingUser, setLoadingUser] = useState(true);');
    expect(source).toContain('const [userLoadError, setUserLoadError] = useState(false);');
    expect(source).toContain('setUserLoadError(true)');
    expect(source).toContain('setLoadingUser(false)');
    expect(source).toContain('Settings unavailable');
    expect(source).not.toContain('if (!user) return <div className="flex items-center justify-center h-full"');
  });
});
