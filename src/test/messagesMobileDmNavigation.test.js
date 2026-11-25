// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Messages mobile DM navigation', () => {
  it('persists selected chats in the URL and clears the URL on back', async () => {
    const source = await readFile(new URL('../../src/pages/Messages.jsx', import.meta.url), 'utf8');
    expect(source).toContain('const nextSearch = `?id=${encodeURIComponent(convId)}`;');
    expect(source).toContain('navigate(`${location.pathname}${nextSearch}`, { replace: true })');
    expect(source).toContain('const handleBackToConversations = () =>');
    expect(source).toContain('navigate(location.pathname, { replace: true })');
    expect(source).toContain('onBack={handleBackToConversations}');
  });

  it('offers a visible recovery path while a selected non-admin DM is not in the conversation cache', async () => {
    const source = await readFile(new URL('../../src/pages/Messages.jsx', import.meta.url), 'utf8');
    expect(source).toContain(') : selectedConvId ? (');
    expect(source).toContain('data-testid="messages-chat-recovery"');
    expect(source).toContain('Opening conversation…');
    expect(source).toContain('queryClient.invalidateQueries({ queryKey: ["conversations", currentUser?.id] })');
    expect(source).toContain('onClick={handleBackToConversations}');
    expect(source).toContain('Back to chats');
  });
});
