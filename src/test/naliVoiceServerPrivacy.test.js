import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Private server-stored NaliVoice contracts', () => {
  it('keeps model rows private by entity RLS and uses verified session identity', async () => {
    const schema = JSON.parse(await readFile('base44/entities/NaliVoicePrivateModel.jsonc', 'utf8'));
    for (const method of ['read', 'create', 'update', 'delete']) {
      expect(schema.rls[method].user_condition.role).toBe('admin');
    }
    const server = await readFile('base44/functions/naliVoicePrivateModel/entry.ts', 'utf8');
    expect(server).toContain('sdk.auth.me()');
    expect(server).toContain('{ user_id: user.id }');
    expect(server).toContain('user_id: user.id');
    expect(server).toMatch(/!record\s*\|\|\s*record\.consent\s*!==\s*true/);
    expect(server).toMatch(/action\s*===\s*['\"]erase['\"]/);
    expect(server).toContain('payload.revision !== record.revision');
  });

  it('requires consent before training, and never sends recorded audio to model service', async () => {
    const client = await readFile('src/lib/naliVoiceModelStore.js', 'utf8');
    const trainer = await readFile('src/lib/naliVoicePrivateTraining.js', 'utf8');
    const recorder = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(client).not.toContain('indexedDB');
    expect(client).not.toContain('localStorage');
    expect(client).toContain("request('save', { model: payload, revision: model._serverRevision })");
    expect(trainer).toContain('await consentCheck(owner)');
    expect(trainer).toContain("type: 'TRAIN'");
    expect(recorder).toContain('trainingOptedInAtStart');
    expect(recorder).toContain('shouldTrainNaliVoiceTake');
  });

  it('deletes private voice weights on account deletion', async () => {
    const source = await readFile('base44/functions/deleteMyAccount/entry.ts', 'utf8');
    expect(source).toContain('entities.NaliVoicePrivateModel.delete(row.id)');
    expect(source.indexOf('entities.NaliVoicePrivateModel.delete(row.id)'))
      .toBeLessThan(source.indexOf('await entities.User.delete(user.id)'));
  });
});
