import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Messages and Studio pagination', () => {
  it('paginates member conversations, thread replies, chat-session tracks, and persisted Studio tracks', async () => {
    const messages = await readFile('src/pages/Messages.jsx', 'utf8');
    const thread = await readFile('src/components/messages/ThreadPanel.jsx', 'utf8');
    const session = await readFile('src/components/messages/ChatSessionViewer.jsx', 'utf8');
    const studio = await readFile('src/pages/Studio.jsx', 'utf8');

    expect(messages).toContain('async function filterAll(entity, query, sort, pageSize = 200)');
    expect(messages).toContain('queryFn: () => filterAll(');
    expect(messages).toContain('{ type: "group", is_public: true },\n      "-last_message_at",\n    );');
    expect(thread).toContain('async function listThreadReplies(threadId)');
    expect(thread).toContain('queryFn: () => listThreadReplies(parentMessage.id)');
    expect(session).toContain('async function listSessionTracks(projectId)');
    expect(session).toContain('const next = await listSessionTracks(message.id)');
    expect(studio).toContain('async function listPersistedTracks(projectId)');
    expect(studio).toContain('const persistedTracks = await listPersistedTracks(roomId)');
  });
});
