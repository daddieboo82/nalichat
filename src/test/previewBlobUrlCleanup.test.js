// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const previewFiles = [
  ['src/components/record/RecordingGuide.jsx', 'practiceUrl'],
  ['src/pages/CreateChallenge.jsx', 'coverPreview'],
  ['src/components/explore/UploadArtDialog.jsx', 'preview'],
  ['src/pages/CoverArt.jsx', 'overlayImageRef'],
];

describe('preview blob URL cleanup', () => {
  for (const [path, stateName] of previewFiles) {
    it(`${path} revokes replaced and unmounted preview URLs`, async () => {
      const source = await readText(path);
      expect(source).toContain(`URL.revokeObjectURL(${stateName})`);
      expect(source).toContain(`[${stateName}]`);
    });
  }
});
