// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('account deletion batch bounds', () => {
  it('batches private records, inbound contacts, moderation, and upload cleanup', async () => {
    const source = await readFile(
      new URL('../../base44/functions/deleteMyAccount/entry.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain('const CLEANUP_BATCH_SIZE = 200;');
    expect(source).toContain("entity.filter(query, '-created_date', CLEANUP_BATCH_SIZE)");
    expect(source).toContain('{ [ownerField]: user.id }');
    expect(source).toContain('{ contact_user_id: user.id }');
    expect(source).toContain('{ user_id: user.id }');
    expect(source).toContain('{ reported_by_id: user.id }');
    expect(source).toContain('{ uploader_id: user.id }');
    expect(source).toContain('share_token_expires_at: null');
  });

  it('batches shared-content anonymization and relationship cleanup', async () => {
    const source = await readFile(
      new URL('../../base44/functions/deleteMyAccount/entry.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain('async function processPagedRows');
    for (const query of [
      '{ sender_id: user.id }',
      '{ reply_to_id: message.id }',
      '{ creator_id: user.id }',
      '{ author_id: user.id }',
      '{ liked_by: user.id }',
      '{ voter_id: user.id }',
      '{ actor_id: user.id }',
    ]) {
      expect(source).toContain(query);
    }
    expect(source).toContain("reply_to_sender: 'Deleted User'");
    expect(source).toContain('{ $pull: { liked_by: user.id } }');
    expect(source).toContain('{ $inc: { vote_count: -1 } }');
  });

  it('batches owned and collaborated project cascades', async () => {
    const source = await readFile(
      new URL('../../base44/functions/deleteMyAccount/entry.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain('{ owner_id: user.id }');
    expect(source).toContain('{ collaborator_ids: user.id }');
    expect(source).toContain("{ track_id: track.id, parent_type: 'track' }");
    expect(source).toContain('{ room_id: project.id }');
    expect(source).toContain('await processPagedRows(entity, { project_id: project.id }');
    expect(source).not.toContain('const rows = await entity.filter({ project_id: project.id })');
    expect(source).not.toContain('const presenceRows = await entities.StudioPresence.filter');
  });
});
