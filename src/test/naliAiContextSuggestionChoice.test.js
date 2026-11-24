// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai contextual suggestion choice', () => {
  it('offers a distinct, user-controlled suggestion when the composer already has text', async () => {
    const source = await read();
    expect(source).toContain('const [contextPrompt, setContextPrompt] = useState(null);');
    expect(source).toContain('{contextPrompt && contextPrompt !== input && (');
    expect(source).toContain('Contextual prompt available');
    expect(source).toContain('onClick={() => { setInput(contextPrompt); setContextPrompt(null); inputRef.current?.focus(); }}');
    expect(source).toContain('Use prompt</button>');
    expect(source).toContain('onClick={() => setContextPrompt(null)}');
    expect(source).toContain('Dismiss</button>');
  });
  it('does not auto-send a suggestion and clears it on account change', async () => {
    const source = await read();
    const choice = source.slice(source.indexOf('{contextPrompt && contextPrompt !== input && ('), source.indexOf('{/* Input */}'));
    expect(choice).not.toContain('sendText(');
    expect(choice).not.toContain('sendAgentText(');
    const reset = source.slice(source.indexOf('identityGenerationRef.current += 1;'), source.indexOf('}, [identityKey]);'));
    expect(reset).toContain('setContextPrompt(null);');
  });
});
