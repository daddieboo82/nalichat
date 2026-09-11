// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('playlist mutation hardening', () => {
  it('uses atomic track mutations and explicit input bounds', async () => {
    const create = await readText('base44/functions/createPlaylist/entry.ts');
    expect(create).toContain("req.method !== 'POST'");
    expect(create).toContain('rawTrackIds.length > 500');
    expect(create).toContain('name.length > 120');
    expect(create).toContain('description.length > 1000');

    const mutate = await readText('base44/functions/mutatePlaylist/entry.ts');
    expect(mutate).toContain("req.method !== 'POST'");
    expect(mutate).toContain('$addToSet: { track_ids: trackId }');
    expect(mutate).toContain('$pull: { track_ids: trackId }');
    expect(mutate).toContain('Playlist track limit reached');
    expect(mutate).toContain("typeof body.is_public !== 'boolean'");
    expect(mutate).not.toContain('slice(0, 120)');
    expect(mutate).not.toContain('slice(0, 1000)');
  });
});
