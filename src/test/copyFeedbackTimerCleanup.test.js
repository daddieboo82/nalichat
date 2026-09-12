// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const files = [
  'src/components/messages/InviteTab.jsx',
  'src/components/GlobalInviteDialog.jsx',
  'src/pages/Squad.jsx',
  'src/components/viralseed/ViralConceptCard.jsx',
];

describe('copy feedback timer cleanup', () => {
  for (const path of files) {
    it(`${path} tracks and clears its copy reset timer`, async () => {
      const source = await readText(path);
      expect(source).toContain('const copyTimerRef = useRef(null);');
      expect(source).toContain('if (copyTimerRef.current) clearTimeout(copyTimerRef.current);');
      expect(source).toContain('copyTimerRef.current = setTimeout');
    });
  }
});
