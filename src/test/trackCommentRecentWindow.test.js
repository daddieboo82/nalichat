import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('track comment bounded ordering', () => {
  it('fetches the newest 200 comments and restores chronological display order', async () => {
    const s = await readFile('base44/functions/trackComments/entry.ts', 'utf8');
    expect(s).toContain("TrackComment.filter({ track_id: parentId }, '-created_date', 200)");
    expect(s).toContain('const comments = rows\n        .reverse()');
    expect(s).not.toContain("TrackComment.filter({ track_id: parentId }, 'created_date', 200)");
  });
});
