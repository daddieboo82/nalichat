// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const assistantSource = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai voice only narrates new assistant replies', () => {
  it('does not narrate old chat history when voice is enabled', async () => {
    const code = await assistantSource();
    expect(code).toContain('const previous = messagesRef.current[messagesRef.current.length - 1];');
    expect(code).toContain('if (previous?.role === "assistant")');
    expect(code).toContain('if (previousId) spokenIdsRef.current.add(previousId);');
    const bindStart = code.indexOf('const bindConversation = (conv, generation');
    const bindEnd = code.indexOf('const createOrRestoreConversation', bindStart);
    const bind = code.slice(bindStart, bindEnd);
    expect(bind).toContain("if (message?.role !== 'assistant') continue;");
    expect(bind).toContain('if (historicalId) spokenIdsRef.current.add(historicalId);');
    expect(bind.indexOf('spokenIdsRef.current.add(historicalId)')).toBeLessThan(bind.indexOf('setMessages(messagesRef.current)'));
    expect(code).toContain('if (!id || spokenIdsRef.current.has(id)) return;');
  });

  it('only narrates nonempty genuine assistant content while voice is on and panel visible', async () => {
    const code = await assistantSource();
    expect(code).toContain('if (!voiceEnabled || !open || minimized || messages.length === 0) return;');
    expect(code).toContain('if (last.role !== "assistant" || !String(last.content || "").trim()) return;');
    expect(code).toContain('if (generation !== speechGenerationRef.current) return;');
  });
});
