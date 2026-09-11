// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('agent message input bounds', () => {
  it('blocks oversized or ineligible requests before agent dispatch', async () => {
    const source = await readText('base44/functions/sendAgentMessage/entry.ts');

    expect(source).toContain('MAX_AGENT_MESSAGE_CHARS = 12_000');
    expect(source).toContain('MAX_CONVERSATION_ID_CHARS = 256');
    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('user.is_banned');
    expect(source).toContain('user.timeout_until');
    expect(source).toContain('content.length > MAX_AGENT_MESSAGE_CHARS');
    expect(source).toContain('status: 413');
    expect(source.indexOf('content.length > MAX_AGENT_MESSAGE_CHARS')).toBeLessThan(
      source.indexOf('base44.agents.getConversation(conversationId)'),
    );
  });
});
