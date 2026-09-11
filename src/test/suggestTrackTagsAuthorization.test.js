// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('track tag suggestion authorization', () => {
  it('supports authenticated agent calls without weakening create automation safety', async () => {
    const source = await readText('base44/functions/suggestTrackTags/entry.ts');

    expect(source).toContain('body?.trackId || body?.track_id');
    expect(source).toContain('base44.auth.me().catch(() => null)');
    expect(source).toContain('track.uploaded_by === caller.id');
    expect(source).toContain('(track.edit_user_ids || []).includes(caller.id)');
    expect(source).toContain("body?.event?.type === 'create'");
    expect(source).toContain('Date.now() - createdAt <= 10 * 60 * 1000');
    expect(source).toContain('const entitlementUserId = caller?.id || uploaderId');
    expect(source).toContain("'ai_track_tag_suggestion'");
  });
});
