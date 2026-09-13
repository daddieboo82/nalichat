import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('missing message deep links', () => {
  it('clears stale mobile conversation state when the requested conversation disappears', async () => {
    const s = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(s).toContain('else if (resolution.status === "missing")');
    expect(s).toContain('setSelectedConvId(null);');
    expect(s).toContain('setLockedLinkConversationId(null);');
    expect(s).toContain('setShowLockedAccess(false);');
    expect(s).toContain('navigate("/messages", { replace: true });');
  });
});
