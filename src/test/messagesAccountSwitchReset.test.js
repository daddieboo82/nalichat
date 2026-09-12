// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Messages account-switch reset', () => {
  it('preserves first-load deep links but clears prior-account chat state on real identity changes', async () => {
    const source = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(source).toContain('const lastMessagesUserIdRef = useRef(undefined);');
    expect(source).toContain('const isInitialIdentityResolution = previousUserId === undefined;');
    expect(source).toContain('if (!isInitialIdentityResolution && previousUserId !== nextUserId)');
    expect(source).toContain('navigate(location.pathname, { replace: true });');
    expect(source).toContain('setShowNewDM(false);');
    expect(source).toContain('setShowNewGroup(false);');
    expect(source).toContain('setShowExternal(false);');
    expect(source).toContain('setShowInvite(false);');
    expect(source).toContain('setSelectedConvId(null);');
  });
});
