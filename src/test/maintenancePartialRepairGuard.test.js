import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('maintenance partial-repair guard', () => {
  it('reports truncation for every bounded collection and refuses repair on partial scans', async () => {
    const s = await readFile('base44/functions/nali-maintenance/entry.ts', 'utf8');
    expect(s).toContain('const collectionCaps = {');
    for (const key of [
      'artPosts', 'projects', 'tracks', 'sharedFiles', 'subscriptions',
      'challenges', 'submissions', 'votes', 'conversations', 'messages',
      'trackVersions', 'playlists', 'usageRateLimits', 'users', 'squads',
    ]) {
      expect(s).toContain(`${key}:`);
    }
    expect(s).toContain("if (mode === 'repair')");
    expect(s).toContain('Maintenance repair requires a complete dataset. Narrow the scope and retry.');
    expect(s).toContain('partial_collections: partialCollections');
    expect(s).toContain('truncated,');
  });
});
