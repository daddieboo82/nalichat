// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('global audio account isolation', () => {
  it('clears loaded media whenever the authenticated identity changes', async () => {
    const source = await readFile('src/lib/AudioPlayerContext.jsx', 'utf8');
    expect(source).toContain("import { useAuth } from '@/lib/AuthContext';");
    expect(source).toContain('const lastUserIdRef = useRef(user?.id || null);');
    expect(source).toContain('if (lastUserIdRef.current !== nextUserId)');
    expect(source).toContain('closePlayer();');
    expect(source).toContain('setCurrentTime(0);');
    expect(source).toContain('setDuration(0);');
    expect(source).toContain('}, [user?.id, closePlayer]);');
  });
});
