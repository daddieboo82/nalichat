// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const invite = 'https://discord.gg/hU9WhHNWA';

describe('official NaliChat Discord community invite', () => {
  for (const [path, label] of [
    ['src/components/GlobalHelpDialog.jsx', 'Join NaliChat Discord'],
    ['src/pages/CreatorMessagingLanding.jsx', 'Join Discord'],
    ['src/pages/Home.jsx', 'Join Discord'],
  ]) {
    it(`exposes the supplied invite on ${path} without replacing existing app navigation`, async () => {
      const source = await readFile(path, 'utf8');
      expect(source).toContain(`href="${invite}"`);
      expect(source).toContain('target="_blank" rel="noopener noreferrer"');
      expect(source).toContain(label);
    });
  }

  it('offers a prominent creator-facing invite and tracks clicks from supported entry points', async () => {
    const landing = await readFile('src/pages/CreatorMessagingLanding.jsx', 'utf8');
    const help = await readFile('src/components/GlobalHelpDialog.jsx', 'utf8');
    const home = await readFile('src/pages/Home.jsx', 'utf8');
    expect(landing).toContain('Join Discord Community');
    expect(landing).toContain('trackProductEvent("discord_invite_click", { source: "creator_messaging_landing", placement: "hero" })');
    expect(help).toContain('trackProductEvent("discord_invite_click", { source: "help_dialog", placement: "community_support" })');
    expect(home).toContain('trackProductEvent("discord_invite_click", { source: "public_home", placement: "footer" })');
  });
});
