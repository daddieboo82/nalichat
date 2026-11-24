// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = () => readFile('src/components/AiAssistant.jsx', 'utf8');

describe('NALI.ai contextual suggestion queue', () => {
  it('queues distinct prompts without replacing earlier suggestions', async () => {
    const source = await read();
    expect(source).toContain('const [contextPrompts, setContextPrompts] = useState([]);');
    expect(source).toContain('setContextPrompts(current => current.includes(text) ? current : [...current, text]);');
    expect(source).toContain('setInput(current => current || text);');
    expect(source).toContain('contextPrompts.filter(prompt => prompt !== input).map(prompt => (');
    expect(source).toContain('aria-label="Pending NALI.ai prompts"');
  });
  it('lets users use or dismiss each prompt separately without sending it', async () => {
    const source = await read();
    const choice = source.slice(source.indexOf('{contextPrompts.some(prompt => prompt !== input) && ('), source.indexOf('{/* Input */}'));
    expect(choice).toContain('setInput(prompt);');
    expect(choice).toContain('setContextPrompts(current => current.filter(item => item !== prompt))');
    expect(choice).toContain('Use prompt</button>');
    expect(choice).toContain('Dismiss</button>');
    expect(choice).not.toContain('sendText(');
    expect(choice).not.toContain('sendAgentText(');
  });
  it('consumes the composer copy when a contextual prompt is edited', async () => {
    const source = await read();
    const composer = source.slice(source.indexOf('aria-label="Message NALI.ai"') - 450, source.indexOf('placeholder="Ask Nali about'));
    expect(composer).toContain('if (next !== input) setContextPrompts(current => current.filter(item => item !== input));');
    expect(composer).toContain('setInput(next);');
    expect(source).toContain('contextPrompts.filter(prompt => prompt !== input).map(prompt => (');
  });
  it('clears the pending prompts when a user switches identity', async () => {
    const source = await read();
    const reset = source.slice(source.indexOf('identityGenerationRef.current += 1;'), source.indexOf('}, [identityKey]);'));
    expect(reset).toContain('setContextPrompts([]);');
  });
});
