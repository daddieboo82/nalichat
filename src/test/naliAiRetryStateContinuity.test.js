// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai retry and reopen state continuity', () => {
  it('does not clear a failed restore just because the chat was reopened', async () => {
    const source = await read();
    const open = source.slice(source.indexOf('const openChat = async (greeting) => {'), source.indexOf('const sendText = async'));
    expect(open).not.toContain('setRestoreError(false)');
    expect(open).toContain('await initConversation();');
    expect(open).toContain('setRestoreError(true);');
    expect(source).toContain('if (!conversationRef.current && (conversationRestoring || restoreError))');
  });
  it('clears the error only after binding a conversation or switching identity', async () => {
    const source = await read();
    const bind = source.slice(source.indexOf('const bindConversation ='), source.indexOf('const createOrRestoreConversation ='));
    expect(bind).toContain('setRestoreError(false);');
    expect(bind.indexOf('conversationRef.current = conv;')).toBeLessThan(bind.indexOf('setRestoreError(false);'));
    const identity = source.slice(source.indexOf('identityGenerationRef.current += 1;'), source.indexOf('}, [identityKey]);'));
    expect(identity).toContain('setRestoreError(false);');
  });
  it('keeps Retry disabled during attempted recovery', async () => {
    const source = await read();
    expect(source).toContain('disabled={restorePending}');
    expect(source).toContain("{restorePending ? 'Restoring…' : 'Retry conversation'}");
  });
});
