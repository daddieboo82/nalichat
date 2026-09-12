// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const protectedViews = [
  'src/pages/Playlists.jsx',
  'src/pages/Analytics.jsx',
  'src/components/explore/AddToPlaylistDialog.jsx',
  'src/pages/Record.jsx',
  'src/pages/Files.jsx',
  'src/pages/PlaylistDetail.jsx',
];

describe('protected views auth state', () => {
  for (const path of protectedViews) {
    it(`${path} uses AuthContext instead of a duplicate auth.me call`, async () => {
      const source = await readText(path);
      expect(source).toContain('useAuth');
      expect(source).toContain('user: currentUser');
      expect(source).not.toContain('setCurrentUser');
      expect(source).not.toContain('base44.auth.me().then');
    });
  }
});
