import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('public room membership cap', () => {
  it('enforces the same 100-member ceiling used by normal groups', async () => {
    const s = await readFile('base44/functions/manageConversation/entry.ts', 'utf8');
    const fullChecks = s.match(/Public room is full/g) || [];
    expect(fullChecks.length).toBeGreaterThanOrEqual(3);
    expect(s).toContain('if (!alreadyParticipant && participants.length > 100)');
    expect(s).toContain('if (!alreadyParticipant && participantIds.length > 100)');
    expect(s).toContain('const updated = alreadyParticipant');
  });
});
