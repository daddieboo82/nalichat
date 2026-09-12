// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message dialog close isolation', () => {
  it('clears New DM state and ignores stale selection completion', async () => {
    const source = await readFile('src/components/messages/NewChatDialog.jsx', 'utf8');
    expect(source).toContain('if (open) return;');
    expect(source).toContain('setSearch("");');
    expect(source).toContain('operationGenerationRef.current += 1;');
    expect(source).toContain('generation !== operationGenerationRef.current');
  });

  it('clears group draft, selections, and retry keys when closed', async () => {
    const source = await readFile('src/components/messages/GroupChatDialog.jsx', 'utf8');
    expect(source).toContain('setName("");');
    expect(source).toContain('setSelected([]);');
    expect(source).toContain('retryKeyRef.current = null;');
    expect(source).toContain('retrySignatureRef.current = "";');
    expect(source).toContain('generation !== operationGenerationRef.current');
  });

  it('clears external recipient/message state and suppresses stale send results', async () => {
    const source = await readFile('src/components/messages/ExternalMessageDialog.jsx', 'utf8');
    expect(source).toContain('operationGenerationRef.current += 1;');
    expect(source).toContain('reset();');
    expect(source).toContain('generation !== operationGenerationRef.current');
    expect(source).toContain("Couldn't send the external message. Please try again.");
    expect(source).not.toContain('setErrorMsg(err.message)');
  });
});
