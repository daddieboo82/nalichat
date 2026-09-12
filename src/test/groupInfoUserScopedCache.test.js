import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('GroupInfoPanel conversation cache scoping', () => {
  it('invalidates only the active user conversation cache', async () => {
    const source = await readFile('src/components/messages/GroupInfoPanel.jsx', 'utf8');
    expect(source).toContain('queryKey: ["conversations", currentUser?.id]');
    expect(source).not.toContain('queryKey: ["conversations"]');
  });
});
