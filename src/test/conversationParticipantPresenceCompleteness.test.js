import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('conversation participant presence completeness', () => {
  it('supplements chat participants and saved contacts outside the bounded public discovery window', async () => {
    const s = await readFile('base44/functions/listPublicUsers/entry.ts', 'utf8');
    expect(s).toContain('const visibleUsers = [...allUsers];');
    expect(s).toContain('if (includePresence) {');
    expect(s).toContain('...presenceVisibleTo,');
    expect(s).toContain('...contacts.map((contact: any) => contact.contact_user_id).filter(Boolean)');
    expect(s).toContain('const missingRelevantIds = [...relevantIds].filter');
    expect(s).toContain('base44.asServiceRole.entities.User.get(targetId).catch(() => null)');
    expect(s).toContain('if (candidate?.id && !loadedIds.has(candidate.id))');
    expect(s).toContain('const publicUsers = visibleUsers');
  });
});
