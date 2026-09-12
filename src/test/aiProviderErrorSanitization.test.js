// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const endpoints = [
  ['base44/functions/generate-speech/entry.ts', 'AI speech generation failed'],
  ['base44/functions/aiMasterSession/entry.ts', 'AI mastering failed'],
  ['base44/functions/generate-cover-art/entry.ts', 'Cover art generation failed'],
  ['base44/functions/generate-viral-moment/entry.ts', 'Viral moment generation failed'],
  ['base44/functions/suggestTrackTags/entry.ts', 'Track tag suggestion failed'],
  ['base44/functions/generateArtistBio/entry.ts', 'Artist bio generation failed'],
  ['base44/functions/get-studio-export-url/entry.ts', 'Unable to create studio export URL'],
];

describe('AI/provider error sanitization', () => {
  for (const [path, message] of endpoints) {
    it(`${path} does not return raw exception messages`, async () => {
      const source = await readText(path);
      expect(source).toContain(`return Response.json({ error: '${message}' }, { status: 500 });`);
      expect(source).not.toContain('return Response.json({ error: error.message }, { status: 500 });');
    });
  }
});
