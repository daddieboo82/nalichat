import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Explore like rollback', () => {
  it('restores the same user-scoped cache key used by the optimistic update', async () => {
    const s = await readFile('src/pages/Explore.jsx', 'utf8');
    expect(s).toContain('["artposts", ctx.filter, currentUser?.id]');
    expect(s).toContain("Couldn't update like. Please try again.");
    expect(s).not.toContain('setQueryData(["artposts", ctx.filter], ctx.previous)');
  });
});
