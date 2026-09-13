import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Studio Editor collaboration UI', () => {
  it('does not simulate collaborator presence with a one-second local interval', async () => {
    const s = await readFile('src/pages/StudioEditor.jsx', 'utf8');
    expect(s).not.toContain('setInterval(handleCollaborationUpdate, 1000)');
    expect(s).not.toContain('setCollaborators([currentUser])');
    expect(s).not.toContain('CollaboratorPresence');
    expect(s).not.toContain('activeSession');
  });
});
