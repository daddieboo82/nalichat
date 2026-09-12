// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Nali AI account isolation', () => {
  it('clears private assistant state on identity or agent-tier changes', async () => {
    const source = await readFile('src/components/AiAssistant.jsx', 'utf8');
    expect(source).toContain('const identityKey = user?.id ?');
    expect(source).toContain('const identityGenerationRef = useRef(0);');
    expect(source).toContain('identityGenerationRef.current += 1;');
    expect(source).toContain('setConversation(null);');
    expect(source).toContain('setMessages([]);');
    expect(source).toContain('setInput("");');
    expect(source).toContain('setOpen(false);');
    expect(source).toContain('if (assistantOwnerKey !== identityKey) return null;');
  });

  it('ignores stale restore, create, subscription, and delayed refresh results', async () => {
    const source = await readFile('src/components/AiAssistant.jsx', 'utf8');
    expect(source).toContain('if (generation !== identityGenerationRef.current) throw staleIdentityError();');
    expect(source).toContain('if (generation !== identityGenerationRef.current) return;');
    expect(source).toContain('bindConversation(restored, generation)');
    expect(source).toContain('bindConversation(conv, generation)');
    expect(source).toContain('error?.code === "NALI_IDENTITY_CHANGED"');
  });
});
