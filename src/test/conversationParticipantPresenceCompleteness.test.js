import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('conversation participant presence completeness', () => {
  it('supplements chat participants outside the bounded public discovery window', async () => {
    const s = await readFile('base44/functions/listPublicUsers/entry.ts', 'utf8');
    expect(s).toContain('const visibleUsers = [...allUsers];');
    expect(s).toContain('if (includePresence) {');
    expect(s).toContain('const missingParticipantIds = [...presenceVisibleTo].filter');
    expect(s).toContain('base44.asServiceRole.entities.User.get(participantId).catch(() => null)');
    expect(s).toContain('const publicUsers = visibleUsers');
  });
});
