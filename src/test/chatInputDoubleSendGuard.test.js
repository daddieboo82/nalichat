// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message composer duplicate-submission guard', () => {
  it('blocks a second submit while the first is in flight and releases the guard on completion or failure', async () => {
    const source = await readFile('src/components/messages/ChatInput.jsx', 'utf8');
    expect(source).toContain('const sendInFlightRef = useRef(false);');
    expect(source).toContain('if (!text.trim() || disabled || sendInFlightRef.current) return;');
    expect(source).toContain('sendInFlightRef.current = true;');
    expect(source).toContain('await Promise.resolve(onSend(payload));');
    expect(source).toContain('} finally {\n      sendInFlightRef.current = false;');
  });

  it('preserves text added while an asynchronous message edit is being confirmed', async () => {
    const source = await readFile('src/components/messages/ChatInput.jsx', 'utf8');
    expect(source).toContain('const submittedText = text;');
    expect(source).toContain('setText((current) => current === submittedText ? "" : current);');
  });
});
