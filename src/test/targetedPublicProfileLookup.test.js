// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('targeted public profile lookup', () => {
  it('loads one public profile without scanning the capped discovery directory', async () => {
    const backend = await readText('base44/functions/listPublicUsers/entry.ts');
    const profile = await readText('src/pages/Profile.jsx');

    expect(backend).toContain("req.method !== 'POST'");
    expect(backend).toContain("const requestedUserId = String(body?.userId || '').trim()");
    expect(backend).toContain('!isBase44EntityId(requestedUserId)');
    expect(backend).toContain('base44.asServiceRole.entities.User.get(requestedUserId)');
    expect(backend).toContain('users: [publicUserProjection(');
    expect(profile).toContain('functions.invoke("listPublicUsers", { userId: targetUserId })');
    expect(profile).toContain('res?.data?.viewerUserId !== currentUser?.id');
    expect(profile).toContain('res?.data?.requestedUserId !== targetUserId');
    expect(profile).toContain('!Array.isArray(res?.data?.users)');
    expect(profile).toContain('return res.data.users[0] || null');
  });
});
