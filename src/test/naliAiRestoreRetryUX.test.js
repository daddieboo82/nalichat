// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai recoverable conversation open UI', () => {
  it('shows an in-panel retry on restore failures without losing the saved ID', async () => {
    const code = await read();
    const open = code.slice(code.indexOf('const openChat = async (greeting) => {'), code.indexOf('const sendText = async'));
    expect(open).toContain('const generation = identityGenerationRef.current;');
    expect(open).toContain('await initConversation();');
    expect(open).toContain('if (generation !== identityGenerationRef.current || error?.code === "NALI_IDENTITY_CHANGED") return;');
    expect(open).toContain('setRestoreError(true);');
    expect(code).toContain("Couldn't load your saved NALI.ai conversation. Your history is preserved.");
    expect(code).toContain('onClick={() => void openChat()}');
    expect(code).toContain("{restorePending ? 'Restoring…' : 'Retry conversation'}</button>");
    expect(code).toContain('disabled={restorePending}');
    expect(code).toContain('Restoring your NALI.ai conversation…');
  });
  it('clears the restore error after a conversation binds or identity changes', async () => {
    const code = await read();
    const bind = code.slice(code.indexOf('const bindConversation ='), code.indexOf('const createOrRestoreConversation ='));
    expect(bind).toContain('setRestoreError(false);');
    const identityReset = code.slice(code.indexOf('identityGenerationRef.current += 1;'), code.indexOf('}, [identityKey]);'));
    expect(identityReset).toContain('setRestoreError(false);');
    expect(identityReset).toContain('setRestorePending(false);');
  });
  it('does not submit or charge a new AI prompt from the retry control', async () => {
    const code = await read();
    const retry = code.slice(code.indexOf('{restoreError && !conversation?.id && ('), code.indexOf('{sendError && ('));
    expect(retry).not.toContain('sendText(');
    expect(retry).not.toContain('sendAgentText(');
    expect(retry).toContain('void openChat()');
    const open = code.slice(code.indexOf('const openChat = async (greeting) => {'), code.indexOf('const sendText = async'));
    expect(open).toContain('setRestorePending(true);');
    expect(open).toContain('if (generation === identityGenerationRef.current) setRestorePending(false);');
  });
});
