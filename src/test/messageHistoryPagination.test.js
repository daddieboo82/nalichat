import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('message history pagination', () => {
  it('loads older messages incrementally without treating history prepends as new unread messages', async () => {
    const messages = await readFile('src/pages/Messages.jsx', 'utf8');
    const chat = await readFile('src/components/messages/ChatView.jsx', 'utf8');
    expect(messages).toContain('const [messageHistoryLimit, setMessageHistoryLimit] = useState(200);');
    expect(messages).toContain('desiredLimit + 1');
    expect(messages).toContain('const hasOlder = rows.length > desiredLimit;');
    expect(messages).toContain('onLoadOlderMessages={() => setMessageHistoryLimit((limit) => limit + 200)}');
    expect(chat).toContain('Load older messages');
    expect(chat).toContain('prevLatestIdRef.current');
    expect(chat).toContain('latestId !== prevLatestIdRef.current');
    expect(messages).not.toContain('Message.filter({ conversation_id: selectedConvId }, "-created_date", 200)');
  });
});
