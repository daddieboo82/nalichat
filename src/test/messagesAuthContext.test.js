// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Messages auth state', () => {
  it('uses AuthContext instead of a one-shot duplicate auth.me call', async () => {
    const source = await readText('src/pages/Messages.jsx');
    expect(source).toContain('import { useAuth } from "@/lib/AuthContext";');
    expect(source).toContain('const { user: currentUser, checkUserAuth } = useAuth();');
    expect(source).not.toContain('const [currentUser, setCurrentUser] = useState(null);');
    expect(source).not.toContain('base44.auth.me().then(setCurrentUser).catch(() => {});');
    expect(source).toContain('void checkUserAuth();');
  });
});
