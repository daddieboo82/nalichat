// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('squad status lookup bounds', () => {
  it('limits active squad and weekly progress lookups to one row', async () => {
    const source = await readText('base44/functions/getSquadBonusStatus/entry.ts');

    expect(source).toContain("Squad.filter({ member_a_id: user.id, status: 'active' }, '-created_date', 1)");
    expect(source).toContain("Squad.filter({ member_b_id: user.id, status: 'active' }, '-created_date', 1)");
    expect(source).toMatch(/SquadProgress\.filter\([\s\S]*week_key: key[\s\S]*'-created_date',[\s\S]*1/);
  });

  it('bounds squad membership scans in create, join, and activity paths', async () => {
    const create = await readText('base44/functions/createSquadInvite/entry.ts');
    const join = await readText('base44/functions/joinSquad/entry.ts');
    const activity = await readText('base44/functions/recordSquadActivity/entry.ts');

    expect(create).toContain('findBlockingSquadMembership(entities, user.id)');
    expect(create).toContain('squad_membership_id: null');
    expect(join).toContain('squad_membership_id: null');
    expect(join).toContain('$set: { squad_membership_id: squad.id }');
    expect(activity).toContain("Squad.filter({ member_a_id: userId, status: 'active' }, '-created_date', 1)");
    expect(activity).toContain("Squad.filter({ member_b_id: userId, status: 'active' }, '-created_date', 1)");
  });
});
