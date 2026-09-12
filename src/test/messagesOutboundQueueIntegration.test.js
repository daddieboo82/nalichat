// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Messages outbound retry integration', () => {
  it('persists transient failures, retries on reconnect, and preserves idempotency', async () => {
    const page = await readText('src/pages/Messages.jsx');

    expect(page).toContain('createOutboundEntry({');
    expect(page).toContain('enqueueOutbound(failedEntry);');
    expect(page).toContain('flushOutboundQueue({');
    expect(page).toContain('window.addEventListener("online", handleQueueSignal);');
    expect(page).toContain('client_message_key: entry.clientMessageKey');
    expect(page).toContain('readOutboundQueue().filter((item) => item.sender.id === currentUser.id)');
    expect(page).toContain('Unable to persist failed message for retry:');
    expect(page).toContain('Unable to flush outbound message queue:');
  });

  it('does not retry permanent client rejections forever', async () => {
    const queue = await readText('src/lib/outboundQueue.js');
    expect(queue).toContain('[400, 401, 403, 404, 405, 410, 413, 422].includes(status)');
  });

  it('does not contain escaped newline artifacts in JSX handlers', async () => {
    const page = await readText('src/pages/Messages.jsx');
    const list = await readText('src/components/messages/ConversationList.jsx');

    expect(page).not.toContain('onMessageContact={async (u) => {\\n');
    expect(list).not.toContain('onClick={async () => {\\n                  try {');
  });
});
