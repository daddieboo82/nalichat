// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('presence polling reliability', () => {
  it('uses a presence-specific cache key and stays below the backend hourly limit', async () => {
    const messages = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(messages).toContain('queryKey: ["users", "presence", currentUser?.id]');
    expect(messages).toContain('refetchInterval: 45_000');
    expect(messages).toContain('staleTime: 20_000');
  });

  it('shares presence cache only with other presence-aware views', async () => {
    const contacts = await readFile('src/components/messages/ContactsTab.jsx', 'utf8');
    const settings = await readFile('src/components/studio/ProjectSettingsDialog.jsx', 'utf8');
    expect(contacts).toContain('queryKey: ["users", "presence", currentUserId]');
    expect(settings).toContain('queryKey: ["users", "directory", currentUser?.id]');
  });
});
