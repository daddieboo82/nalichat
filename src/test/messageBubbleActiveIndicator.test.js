import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message bubble active indicator', () => {
  it('shows active status directly on every incoming bubble', async () => {
    const source = await readFile('src/components/messages/MessageBubble.jsx', 'utf8');
    expect(source).toContain('{!isOwn && senderIsOnline && (');
    expect(source).toContain('title="Active now"');
    expect(source).toContain('bg-green-500');
    const bubbleMarker = source.indexOf('chat-message-other');
    const presenceMarker = source.indexOf('{!isOwn && senderIsOnline && (');
    expect(presenceMarker).toBeGreaterThan(bubbleMarker);
  });
});
