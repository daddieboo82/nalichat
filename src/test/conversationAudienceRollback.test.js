import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('conversation audience rollback', () => {
  it('restores Conversation membership when cached audience sync fails', async () => {
    const s = await readFile('base44/functions/manageConversation/entry.ts', 'utf8');
    const helper = s.indexOf('async function updateConversationAudienceSafely');
    const parentUpdate = s.indexOf('await entities.Conversation.update(', helper);
    const sync = s.indexOf('await syncConversationAudience(entities, conversation.id, participantIds)', parentUpdate);
    const rollbackParent = s.indexOf("{ participant_ids: originalParticipantIds }", sync);
    const rollbackSync = s.indexOf('originalParticipantIds,', rollbackParent);

    expect(helper).toBeGreaterThan(-1);
    expect(parentUpdate).toBeGreaterThan(helper);
    expect(sync).toBeGreaterThan(parentUpdate);
    expect(rollbackParent).toBeGreaterThan(sync);
    expect(rollbackSync).toBeGreaterThan(rollbackParent);
    expect(s.match(/updateConversationAudienceSafely\(/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('keeps Message reads scoped by cached participant_ids', async () => {
    const message = await readFile('base44/entities/Message.jsonc', 'utf8');
    expect(message).toContain('"data.participant_ids": "{{user.id}}"');
  });
});
