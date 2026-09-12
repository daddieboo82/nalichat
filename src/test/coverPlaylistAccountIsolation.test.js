// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Cover Art and playlist account isolation', () => {
  it('scopes playlist-track cache and clears private cover state on account changes', async () => {
    const source = await readFile('src/pages/CoverArt.jsx', 'utf8');
    expect(source).toContain('queryKey: ["playlistTracks", currentUser?.id, selectedPlaylist?.id]');
    expect(source).toContain('}, [currentUser?.id]);');
    expect(source).toContain('setSelectedPost(null);');
    expect(source).toContain('setGeneratedImage(null);');
    expect(source).toContain('setSelectedPlaylist(null);');
    expect(source).toContain('setOverlayImageRef(null);');
    expect(source).toContain('setShowEditDialog(false);');
  });

  it('clears create-playlist drafts when the account changes', async () => {
    const source = await readFile('src/pages/Playlists.jsx', 'utf8');
    expect(source).toContain('import { useState, useEffect } from "react";');
    expect(source).toContain('setShowCreateDialog(false);');
    expect(source).toContain('setFormData({ name: "", description: "" });');
    expect(source).toContain('}, [currentUser?.id]);');
  });
});
