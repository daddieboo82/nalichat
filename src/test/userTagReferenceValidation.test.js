import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('user and tag reference validation', () => {
  it('validates public achievement target ids before user lookup', async () => {
    const s=await readFile('base44/functions/listPublicAchievements/entry.ts','utf8');
    expect(s.indexOf('isBase44EntityId(targetUserId)')).toBeLessThan(s.indexOf('User.get(targetUserId)'));
  });
  it('validates optional public user ids before target lookup', async () => {
    const s=await readFile('base44/functions/listPublicUsers/entry.ts','utf8');
    expect(s).toContain('requestedUserId && !isBase44EntityId(requestedUserId)');
  });
  it('validates stored uploader and project references before tag lookups', async () => {
    const s=await readFile('base44/functions/suggestTrackTags/entry.ts','utf8');
    expect(s.indexOf('!isBase44EntityId(uploaderId)')).toBeLessThan(s.indexOf('User.get(uploaderId)'));
    expect(s).toContain('trackPreview.project_id && isBase44EntityId(trackPreview.project_id)');
  });
});
