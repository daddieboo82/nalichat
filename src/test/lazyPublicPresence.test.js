// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('lazy public presence enrichment', () => {
  it('skips relationship scans unless a caller explicitly requests presence', async () => {
    const backend = await readText('base44/functions/listPublicUsers/entry.ts');
    const messages = await readText('src/pages/Messages.jsx');
    const profile = await readText('src/pages/Profile.jsx');
    const leaderboard = await readText('src/pages/Leaderboard.jsx');

    expect(backend).toContain('body?.includePresence === true');
    expect(backend).toContain('if (includePresence) {');
    expect(backend).toContain('entities.Contact');
    expect(backend).toContain('entities.Conversation');
    expect(messages).toContain('includePresence: true');
    expect(profile).not.toContain('includePresence: true');
    expect(leaderboard).not.toContain('includePresence: true');
  });
});
