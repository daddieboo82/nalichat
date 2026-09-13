// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('auth refresh contract', () => {
  it('awaits retry delays and returns the refreshed user', async () => {
    const source = await readText('src/lib/AuthContext.jsx');
    expect(source).toContain('const checkUserAuth = useCallback(async (retryCount = 0, existingGeneration = null) => {');
    expect(source).toContain('}, [queryClient]);');
    expect(source).toContain('return currentUser;');
    expect(source).toContain('await new Promise((resolve) => setTimeout(resolve, delay));');
    expect(source).toContain('return checkUserAuth(retryCount + 1, generation);');
    expect(source).not.toContain('setTimeout(() => checkUserAuth(retryCount + 1), delay);');
  });

  it('Profile uses the shared auth user and refresh contract', async () => {
    const source = await readText('src/pages/Profile.jsx');
    expect(source).toContain('const { user: currentUser, checkUserAuth } = useAuth();');
    expect(source).not.toContain('const [currentUser, setCurrentUser] = useState(null);');
    expect(source).not.toContain('base44.auth.me().then');
    expect(source).not.toContain('setCurrentUser(');
    expect(source).toContain('await checkUserAuth();');
  });
});
