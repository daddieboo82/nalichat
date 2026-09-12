import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Messages presence lifecycle', () => {
  it('keeps conversation switching independent from the app-wide presence heartbeat', async () => {
    const source = await readFile('src/pages/Messages.jsx', 'utf8');
    expect(source).not.toContain('updateUserPresence');
    expect(source).toContain('Presence itself is maintained app-wide in App.jsx.');
    expect(source).toContain('queryKey: ["messages", currentUser?.id, selectedConvId]');
    expect(source).toContain('}, [currentUser?.id, queryClient, selectedConvId]);');
  });
});
