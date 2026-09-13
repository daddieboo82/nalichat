// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('client collection read behavior', () => {
  it('keeps bounded history feeds capped while complete-data views paginate', async () => {
    const versions = await readText('src/components/studio/TrackVersionHistory.jsx');
    const contacts = await readText('src/components/messages/ContactsTab.jsx');
    const newChat = await readText('src/components/messages/NewChatDialog.jsx');
    const files = await readText('src/pages/Files.jsx');
    const summary = await readText('src/pages/ProjectsSummary.jsx');
    const quick = await readText('src/components/home/QuickAccessGrid.jsx');
    const session = await readText('src/components/messages/ChatSessionViewer.jsx');

    // Version history paginates so older saved versions are not silently dropped.
    expect(versions).toContain('async function listAllTrackVersions(trackId)');
    expect(versions).toMatch(/TrackVersion\.filter\([\s\S]*pageSize,[\s\S]*skip/);

    // Complete-data surfaces must not silently truncate older accessible rows.
    expect(contacts).toContain('async function listAllContacts(userId)');
    expect(newChat).toContain('async function listAllContacts(userId)');
    expect(files).toContain('async function listAllAccessible(entity, sort = "-created_date", pageSize = 200)');
    expect(summary).toContain('async function listAllRows(entity, sort = "-created_date", pageSize = 200)');
    expect(quick).toContain('async function listAllUserConversations(userId)');
    expect(session).toContain('async function listSessionTracks(projectId)');

    expect(contacts).not.toContain('Contact.filter({ user_id: currentUserId }, "-created_date", 500)');
    expect(newChat).not.toContain('Contact.filter({ user_id: currentUserId }, "-created_date", 500)');
    expect(files).not.toContain('SharedFile.list("-created_date", 500)');
    expect(files).not.toContain('Project.list("-created_date", 500)');
    expect(summary).not.toContain('Milestone.list("-created_date", 500)');
    expect(quick).not.toContain('"-last_message_at",\n          500,');
    expect(session).not.toContain('Track.filter({ project_id: message.id }, "created_date", 500)');
  });
});
