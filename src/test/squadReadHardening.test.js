import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('squad read hardening', () => {
  it('requires POST and rate-limits squad bonus reads before service-role access', async () => {
    const source = await readFile('base44/functions/getSquadBonusStatus/entry.ts', 'utf8');
    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain("'squad_bonus_status'");
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(source.indexOf('entities.Squad.filter'));
  });

  it('rate-limits squad leave before privileged squad lookup', async () => {
    const source = await readFile('base44/functions/leaveSquad/entry.ts', 'utf8');
    expect(source).toContain('normalizedSquadId');
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(source.indexOf('entities.Squad.get(normalizedSquadId)'));
    expect(source).toContain("return Response.json({ error: 'Valid squadId is required' }, { status: 400 });");
  });
});
