// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Messages public directory query', () => {
  it('validates only the directory response and does not reference reaction variables from another mutation', async () => {
    const source = await readFile('src/pages/Messages.jsx', 'utf8');
    const start = source.indexOf('queryKey: ["users", "presence", currentUser?.id]');
    const end = source.indexOf('queryKey: ["conversations", currentUser?.id]', start);
    const block = source.slice(start, end);

    expect(block).toContain('res?.data?.viewerUserId !== currentUser?.id');
    expect(block).toContain('!Array.isArray(res?.data?.users)');
    expect(block).toContain('return res.data?.users || []');
    expect(block).not.toContain('messageId');
    expect(block).not.toContain('Reaction update was not confirmed.');
  });
});
