import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('bounded message history fetches', () => {
  it('keeps backend message reads in 200-row pages as visible history grows', async () => {
    const s = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(s).toContain('async function fetchRecentMessageHistory(conversationId, desiredLimit)');
    expect(s).toContain('const pageSize = 200;');
    expect(s).toContain('for (let skip = 0; rows.length < target; skip += pageSize)');
    expect(s).toContain('Math.min(pageSize, target - rows.length)');
    expect(s).toContain('queryFn: () => fetchRecentMessageHistory(selectedConvId, messageHistoryLimit)');
    expect(s).not.toContain('messageHistoryLimit + 1,\n      );');
  });
});
