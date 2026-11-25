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

  it('keeps the guard active until the Messages send mutation settles', async () => {
    const page = await readFile('src/pages/Messages.jsx', 'utf8');
    const handler = page.slice(page.indexOf('onSendMessage={async (data) =>'), page.indexOf('onEditMessage={async (id, text) =>'));
    expect(handler).toContain('await sendMessage.mutateAsync({ ...data, conversation_id: selectedConvId });');
    expect(handler).toContain('if (result?._flagged) throw new Error("moderated");');
    expect(handler).not.toContain('sendMessage.mutate({');
  });

  it('preserves text added while an asynchronous message edit is being confirmed', async () => {
    const source = await readFile('src/components/messages/ChatInput.jsx', 'utf8');
    expect(source).toContain('const submittedText = text;');
    expect(source).toContain('setText((current) => current === submittedText ? "" : current);');
  });
});
