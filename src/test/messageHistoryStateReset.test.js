import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message history state reset', () => {
  it('returns history depth to 200 when identity or active conversation state is cleared', async () => {
    const s = await readFile('src/pages/Messages.jsx', 'utf8');
    const accountReset = s.indexOf('previousUserId !== nextUserId');
    expect(s.indexOf('setMessageHistoryLimit(200);', accountReset)).toBeGreaterThan(accountReset);
    expect(s).toContain('if (location.pathname === "/messages" && !location.search) {\n      setSelectedConvId(null);\n      setMessageHistoryLimit(200);');
    expect(s).toContain('resolution.status === "locked"');
    expect(s).toContain('resolution.status === "missing"');
    expect((s.match(/setMessageHistoryLimit\(200\);/g) || []).length).toBeGreaterThanOrEqual(5);
  });
});
