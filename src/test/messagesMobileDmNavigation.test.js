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
});
