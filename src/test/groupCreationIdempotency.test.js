// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('group creation idempotency', () => {
  it('reuses a stable client request key for ambiguous retries', async () => {
    const dialog = await readText('src/components/messages/GroupChatDialog.jsx');
    const page = await readText('src/pages/Messages.jsx');

    expect(dialog).toContain('retrySignatureRef.current === signature');
    expect(dialog).toContain('client_request_key: clientRequestKey');
    expect(page).toContain('client_request_key,');
  });

  it('returns the original group for the same request key and rejects key reuse with different data', async () => {
    const backend = await readText('base44/functions/manageConversation/entry.ts');

    expect(backend).toContain("hashedConversationId('group_request'");
    expect(backend).toContain('client_request_key was already used for a different group request');
    expect(backend).toContain('duplicate: true');
    expect(backend).toContain("consumeHourlyLimit(entities, user.id, 'conversation_create', 60)");
  });
});
