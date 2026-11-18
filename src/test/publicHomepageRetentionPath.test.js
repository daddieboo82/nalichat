// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('public homepage learn-before-signup path', () => {
  it('offers the existing public feature overview without replacing signup', () => {
    const home = readFileSync('src/pages/Home.jsx', 'utf8');
    const app = readFileSync('src/App.jsx', 'utf8');
    expect(home).toContain('Create your free account');
    expect(home).toContain('See how NaliChat works before joining');
    expect(home).toContain('to="/music-collaboration" onClick={() => trackProductEvent("homepage_demo_click", { source: "public_landing_hero", cta: "see_how_it_works" })}');
    expect(app).toContain('<Route path="/music-collaboration" element={<MusicCollaborationLanding />} />');
  });
});
