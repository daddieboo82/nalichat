// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('expensive AI endpoint HTTP methods', () => {
  it('rejects non-POST traffic before auth or integration work', async () => {
    for (const path of [
      'base44/functions/generate-cover-art/entry.ts',
      'base44/functions/generate-speech/entry.ts',
      'base44/functions/generate-viral-moment/entry.ts',
      'base44/functions/generateArtistBio/entry.ts',
      'base44/functions/generateViralConcepts/entry.ts',
      'base44/functions/transcribeMessageAudio/entry.ts',
      'base44/functions/bounceAndMaster/entry.ts',
      'base44/functions/aiMasterSession/entry.ts',
    ]) {
      const source = await readText(path);
      expect(source).toContain("req.method !== 'POST'");
      expect(source.indexOf("req.method !== 'POST'")).toBeLessThan(
        source.indexOf('createClientFromRequest(req)'),
      );
    }
  });
});
