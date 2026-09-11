// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('failed message retry UI', () => {
  it('renders retry state and reuses the same client message key', async () => {
    const page = await readText('src/pages/Messages.jsx');
    const chat = await readText('src/components/messages/ChatView.jsx');
    const bubble = await readText('src/components/messages/MessageBubble.jsx');

    expect(page).toContain('applyQueuedMessage(old, tempMsg)');
    expect(page).toContain('_deliveryState: "sending"');
    expect(page).toContain('client_message_key: message.client_message_key');
    expect(chat).toContain('onRetry={onRetryMessage}');
    expect(bubble).toContain('message._deliveryState === "failed"');
    expect(bubble).toContain('aria-label="Retry message"');
    expect(bubble).toContain('onClick={() => onRetry(message)}');
  });
});
