// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('global invite account isolation', () => {
  it('clears private invite draft state only on real identity changes', async () => {
    const source = await readFile('src/components/GlobalInviteDialog.jsx', 'utf8');
    expect(source).toContain('const lastUserIdRef = useRef(user?.id || null);');
    expect(source).toContain('if (lastUserIdRef.current === nextUserId) return;');
    expect(source).toContain('setPhone("");');
    expect(source).toContain('setSmsStatus(null);');
    expect(source).toContain('onOpenChange(false);');
  });
});
