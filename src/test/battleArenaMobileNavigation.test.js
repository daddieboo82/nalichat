import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Battle Arena mobile section navigation', () => {
  it('exposes quick access to live battles, personal battles, and pending invitations', async () => {
    const source = await readFile('src/pages/BattleLobby.jsx', 'utf8');
    expect(source).toContain('aria-label="Battle Arena sections"');
    for (const id of ['arena-live', 'arena-mine', 'arena-invites']) {
      expect(source).toContain(`href="#${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
    expect(source).toContain("battle.status === 'invited'");
    expect(source).toContain('battle invitation{pendingInvitations.length === 1');
    expect(source).toContain('to="/battles/new"');
  });
});