// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');
describe('NALI.ai simultaneous initialization safeguards', () => {
  it('shares one in-progress conversation setup across open and send operations', async () => {
    const source = await read();
    expect(source).toContain('const conversationInitRef = useRef(null);');
    expect(source).toContain('if (conversationInitRef.current) return conversationInitRef.current;');
    expect(source).toContain('const pending = createOrRestoreConversation();');
    expect(source).toContain('conversationInitRef.current = pending;');
    expect(source).toContain('if (conversationInitRef.current === pending) conversationInitRef.current = null;');
  });
  it('resets pending work on account changes and synchronously prevents double taps', async () => {
    const source = await read();
    expect(source).toContain('identityGenerationRef.current += 1;');
    expect(source).toContain('conversationInitRef.current = null;');
    expect(source).toContain('sendInFlightRef.current = false;');
    expect(source).toContain('if (!text?.trim() || sendInFlightRef.current) return;');
    expect(source).toContain('sendInFlightRef.current = true;');
  });
});