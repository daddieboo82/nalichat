import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('conversation and contact lookup hardening', () => {
  it('validates participant ids and throttles target lookups before user reads', async () => {
    const source = await readFile('base44/functions/manageConversation/entry.ts', 'utf8');
    expect(source).toContain('!isBase44EntityId(id)');
    expect(source).toContain("'conversation_target_lookup'");
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(source.indexOf('entities.User.get(otherUserId)'));
  });

  it('validates contact add/delete identifiers before privileged reads', async () => {
    const source = await readFile('base44/functions/mutateContact/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(targetUserId)');
    expect(source).toContain('/^contact_[0-9a-f]{64}$/');
    expect(source.indexOf('isBase44EntityId(targetUserId)')).toBeLessThan(source.indexOf('entities.User.get(targetUserId)'));
    expect(source.indexOf('/^contact_[0-9a-f]{64}$/')).toBeLessThan(source.indexOf('entities.Contact.get(contactId)'));
  });
});
