import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Studio share draft', () => {
  it('opens Messages and prefills the active chat composer instead of logging a placeholder', async () => {
    const editor = await readFile('src/pages/StudioEditor.jsx', 'utf8');
    const messages = await readFile('src/pages/Messages.jsx', 'utf8');
    const chat = await readFile('src/components/messages/ChatInput.jsx', 'utf8');
    expect(editor).toContain("navigate('/messages', { state: { composeText: shareText } })");
    expect(editor).not.toContain("console.log('Share via messages:'");
    expect(messages).toContain('initialComposeText={sharedComposeText}');
    expect(chat).toContain('initialText = ""');
    expect(chat).toContain('setText(initialText);');
  });
});
