import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('AI and workflow backend SDK alignment', () => {
  it('uses Base44 SDK 0.8.44 across AI, mastering, and notification workflows', async () => {
    const paths = [
      'base44/functions/generateArtistBio/entry.ts',
      'base44/functions/generate-speech/entry.ts',
      'base44/functions/aiMasterSession/entry.ts',
      'base44/functions/generate-cover-art/entry.ts',
      'base44/functions/suggestTrackTags/entry.ts',
      'base44/functions/bounceAndMaster/entry.ts',
      'base44/functions/generate-viral-moment/entry.ts',
      'base44/functions/notifyOnFileUpload/entry.ts',
      'base44/functions/notifyOnTrackComment/entry.ts',
      'base44/functions/notifyOnTrackVersion/entry.ts',
      'base44/functions/notifyOnMilestoneUpdate/entry.ts',
    ];
    for (const path of paths) {
      const source = await readFile(path, 'utf8');
      expect(source).toContain('npm:@base44/sdk@0.8.44');
      expect(source).not.toContain('npm:@base44/sdk@0.8.31');
    }
  });
});
