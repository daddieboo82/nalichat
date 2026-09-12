// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('follow-up reminder push wiring', () => {
  it('wires the scheduled processor to server Web Push', async () => {
    const source = await readText('base44/functions/processDueFollowUpReminders/entry.ts');

    expect(source).toContain("import { sendPushToUser } from '../../shared/webPush.ts';");
    expect(source).toContain('sendPush: (userId, payload) => sendPushToUser(entities, userId, payload)');
  });
});
