import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('analytics like-count consistency', () => {
  it('uses the canonical like count in detailed rows and engagement math', async () => {
    const s = await readFile('src/pages/Analytics.jsx', 'utf8');
    expect(s).toContain('const likeCount = getLikeCount(post);');
    expect(s).toContain('((likeCount / post.views) * 100).toFixed(1)');
    expect(s).toContain('>{likeCount}</td>');
    expect(s).not.toContain('((post.likes / post.views) * 100).toFixed(1)');
  });
});
