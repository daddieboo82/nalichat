import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('public squad invite abuse protection', () => {
  it('rate limits invite-code lookups before service-role squad reads', async () => {
    const source = await readFile('base44/functions/getSquadInvite/entry.ts', 'utf8');

    expect(source).toContain("import { consumeHourlyLimit } from '../../shared/rateLimit.ts';");
    expect(source).toContain("'squad_invite_lookup'");
    expect(source).toContain('120');
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(
      source.indexOf('asServiceRole.entities.Squad.filter('),
    );
    expect(source).toContain('squad_invite_anon_');
    expect(source).toContain('squad_invite_user_');
    expect(source).toContain("{ status: 429 }");
  });
});
