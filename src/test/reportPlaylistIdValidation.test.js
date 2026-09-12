import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('report and playlist id validation', () => {
  it('validates reported content ids before privileged lookup', async () => {
    const s=await readFile('base44/functions/reportContent/entry.ts','utf8');
    const check=s.indexOf('isBase44EntityId(normalizedContentId)');
    expect(check).toBeGreaterThan(-1);
    expect(s.indexOf('Message.get(normalizedContentId)')).toBeGreaterThan(check);
    expect(s.indexOf('ArtPost.get(normalizedContentId)')).toBeGreaterThan(check);
  });
  it('validates playlist track ids before art-post lookup', async () => {
    const s=await readFile('base44/functions/createPlaylist/entry.ts','utf8');
    const check=s.indexOf('trackIds.some((id) => !isBase44EntityId(id))');
    const lookup=s.indexOf('entities.ArtPost.get(trackId)');
    expect(check).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(check);
  });
});
