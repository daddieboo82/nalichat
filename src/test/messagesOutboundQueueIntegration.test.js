// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Messages outbound queue integration', () => {
  it('persists transient failures, hydrates them, and scopes retries to stable message keys', async () => {
    const page = await readText('src/pages/Messages.jsx');
    const cache = await readText('src/lib/messageCache.js');

    expect(page).toContain('createOutboundEntry({');
    expect(page).toContain('enqueueOutbound(failedEntry);');
    expect(page).toContain('flushOutboundQueue({');
    expect(page).toContain('window.addEventListener("online", handleQueueSignal);');
    expect(page).toContain('for (const entry of readOutboundQueue().filter');
    expect(page).toContain('markOutboundForRetry(message.client_message_key)');
    expect(page).toContain('client_message_key: entry.clientMessageKey');
    expect(cache).toContain('retryable = true');
    expect(cache).toContain('_retryable: retryable');
  });
});
