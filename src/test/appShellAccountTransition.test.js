// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('app shell account transitions', () => {
  it('closes global desktop overlays on a real identity change', async () => {
    const source = await readFile('src/components/layout/AppLayout.jsx', 'utf8');
    expect(source).toContain('const lastUserIdRef = useRef(user?.id || null);');
    expect(source).toContain('if (lastUserIdRef.current === nextUserId) return;');
    expect(source).toContain('setShowHelp(false);');
    expect(source).toContain('setShowInvite(false);');
    expect(source).toContain('setShowMessage(false);');
  });

  it('closes the mobile navigation sheet on account changes', async () => {
    const source = await readFile('src/components/navigation/MobileHeader.jsx', 'utf8');
    expect(source).toContain('const lastUserIdRef = useRef(user?.id || null);');
    expect(source).toContain('setMenuOpen(false);');
    expect(source).toContain('}, [user?.id]);');
  });
});
