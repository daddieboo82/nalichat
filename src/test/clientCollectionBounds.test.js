// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('client collection read bounds', () => {
  it('caps high-volume user-facing collection reads', async () => {
    const versions = await readText('src/components/studio/TrackVersionHistory.jsx');
    const contacts = await readText('src/components/messages/ContactsTab.jsx');
    const newChat = await readText('src/components/messages/NewChatDialog.jsx');
    const files = await readText('src/pages/Files.jsx');
    const summary = await readText('src/pages/ProjectsSummary.jsx');
    const quick = await readText('src/components/home/QuickAccessGrid.jsx');
    const session = await readText('src/components/messages/ChatSessionViewer.jsx');

    expect(versions).toContain('TrackVersion.filter({ track_id: track.id }, "-version_number", 500)');
    expect(contacts).toContain('Contact.filter({ user_id: currentUserId }, "-created_date", 500)');
    expect(newChat).toContain('Contact.filter({ user_id: currentUserId }, "-created_date", 500)');
    expect(files).toContain('SharedFile.list("-created_date", 500)');
    expect(files).toContain('Project.list("-created_date", 500)');
    expect(summary).toContain('Milestone.list("-created_date", 500)');
    expect(quick).toContain('Conversation.list("-last_message_at", 500)');
    expect(session).toContain('Track.filter({ project_id: message.id }, "created_date", 500)');
  });
});
