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
});
