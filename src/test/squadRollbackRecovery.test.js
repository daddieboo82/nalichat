// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('squad rollback recovery', () => {
  it('requires POST and reports join cleanup failures', async () => {
    const source = await readText('base44/functions/joinSquad/entry.ts');

    expect(source).toContain("if (req.method !== 'POST')");
    expect(source).toContain('Expired squad cleanup was incomplete. Please retry.');
    expect(source).toContain('Invite was claimed, but membership rollback was incomplete. Please retry.');
    expect(source).toContain('Squad verification failed and membership rollback was incomplete. Please retry.');
    expect(source).not.toContain('squad_membership_id: null },\n        { $set: { squad_membership_id: null } },\n      ).catch(() => {});');
  });

  it('requires POST and reports invite cleanup failures', async () => {
    const source = await readText('base44/functions/createSquadInvite/entry.ts');

    expect(source).toContain("if (req.method !== 'POST')");
    expect(source).toContain('Expired squad cleanup was incomplete. Please retry.');
    expect(source).toContain('Squad invite creation conflicted and rollback was incomplete. Please retry.');
    expect(source).not.toContain('await entities.Squad.delete(squad.id).catch(() => {});');
  });
});
