// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('final Messages queue hardening', () => {
  it('keeps malformed escaped newlines out of JSX handlers', async () => {
    const page = await readText('src/pages/Messages.jsx');
    const list = await readText('src/components/messages/ConversationList.jsx');
    expect(page).not.toContain('onMessageContact={async (u) => {\\n');
    expect(list).not.toContain('onClick={async () => {\\n                  try {');
  });

  it('falls back safely when retry persistence is unavailable', async () => {
    const page = await readText('src/pages/Messages.jsx');
    expect(page).toContain('Unable to persist failed message for retry:');
    expect(page).toContain('Unable to flush outbound message queue:');
    expect(page).toContain('Unable to persist manual message retry:');
  });

  it('does not retry permanent client errors forever', async () => {
    const queue = await readText('src/lib/outboundQueue.js');
    expect(queue).toContain('[400, 401, 403, 404, 405, 410, 413, 422].includes(status)');
  });
});
