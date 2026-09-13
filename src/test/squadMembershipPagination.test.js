import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('squad membership pagination and cleanup', () => {
  it('pages through both membership sides instead of stopping at 100 rows', async () => {
    const s=await readFile('base44/shared/squadMembership.ts','utf8');
    expect(s).toContain('const SQUAD_MEMBERSHIP_PAGE_SIZE = 200;');
    expect(s).toContain("for (const field of ['member_a_id', 'member_b_id'])");
    expect(s).toContain('for (let skip = 0; ; skip += SQUAD_MEMBERSHIP_PAGE_SIZE)');
    expect(s).toContain('if (rows.length < SQUAD_MEMBERSHIP_PAGE_SIZE) break;');
  });
  it('cleans expired pending squads and stale ended membership pointers', async () => {
    const s=await readFile('base44/shared/squadMembership.ts','utf8');
    expect(s).toContain("squad.status === 'pending' && isSquadInviteExpired(squad)");
    expect(s).toContain("squad.status === 'ended'");
    expect(s).toContain('squad_membership_id: squad.id');
    expect(s).toContain("{ $set: { squad_membership_id: null } }");
  });
  it('uses the shared scan in both invite creation and join', async () => {
    const create=await readFile('base44/functions/createSquadInvite/entry.ts','utf8');
    const join=await readFile('base44/functions/joinSquad/entry.ts','utf8');
    expect(create).toContain('findBlockingSquadMembership(entities, user.id)');
    expect(join).toContain('findBlockingSquadMembership(entities, user.id)');
    expect(create).not.toContain("Squad.filter({ member_a_id: user.id }, '-created_date', 100)");
    expect(join).not.toContain("Squad.filter({ member_a_id: user.id }, '-created_date', 100)");
  });
  it('loads the full client-side squad membership history before choosing the active squad', async () => {
    const source = await readFile('src/pages/Squad.jsx', 'utf8');
    expect(source).toContain('async function listAllSquads(query)');
    expect(source).toContain('const pageSize = 200');
    expect(source).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(source).toContain('listAllSquads({ member_a_id: requestedUserId })');
    expect(source).toContain('listAllSquads({ member_b_id: requestedUserId })');
  });
});
