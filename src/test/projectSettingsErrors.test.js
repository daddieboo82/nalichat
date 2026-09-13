import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio project settings failures', () => {
  it('surfaces collaborator directory and mutation failures', async () => {
    const s = await readFile('src/components/studio/ProjectSettingsDialog.jsx', 'utf8');
    expect(s).toContain('isError: usersError');
    expect(s).toContain("Couldn't load collaborators");
    expect(s).toContain('if (response?.data?.error) throw new Error(response.data.error);');
    expect(s).toContain('res?.data?.success !== true');
    expect(s).toContain('res?.data?.viewerUserId !== currentUser?.id');
    expect(s).toContain('!Array.isArray(res?.data?.users)');
    expect(s).toContain('Collaborator directory response was not confirmed.');
    expect(s).toContain('response?.data?.success !== true');
    expect(s).toContain('Collaborator update was not confirmed.');
    expect(s).toContain('res?.data?.action !== "delete_project"');
    expect(s).toContain('res?.data?.userId !== currentUser?.id');
    expect(s).toContain('res?.data?.project_id !== project.id');
    expect(s).toContain('Project deletion was not confirmed.');
    expect(s).toContain("Couldn't update this collaborator. Please try again.");
    expect(s).toContain("Couldn't delete this project. Please try again.");
  });
});
