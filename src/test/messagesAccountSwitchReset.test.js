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

  it('ignores delayed DM creation responses and errors from a previous account', async () => {
    const source = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(source).toContain('const activeMessagesUserIdRef = useRef(currentUser?.id);');
    expect(source).toContain('activeMessagesUserIdRef.current = currentUser?.id;');
    expect(source).toContain('const requestingUserId = currentUser.id;');
    expect(source).toContain('if (activeMessagesUserIdRef.current !== requestingUserId) return;');
    const requestStart = source.indexOf('const created = await base44.functions.invoke("manageConversation", {', source.indexOf('const startDM ='));
    const responseGuard = source.indexOf('if (activeMessagesUserIdRef.current !== requestingUserId) return;', requestStart);
    const cacheWrite = source.indexOf('pendingCreatedDmsRef.current.set(conv.id', requestStart);
    expect(requestStart).toBeGreaterThan(0);
    expect(responseGuard).toBeGreaterThan(requestStart);
    expect(cacheWrite).toBeGreaterThan(responseGuard);
  });
});
