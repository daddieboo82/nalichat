// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function source() {
  return readFile(new URL('../../base44/functions/manageCollaboration/entry.ts', import.meta.url), 'utf8');
}

describe('manageCollaboration authorization', () => {
  it('requires a valid project-backed session and membership before session actions', async () => {
    const text = await source();
    expect(text).toContain("typeof session_id !== 'string'");
    expect(text).toContain('entities.Project.get(session_id)');
    expect(text).toContain('project.owner_id === user.id');
    expect(text).toContain('collaboratorIds.includes(user.id)');
    expect(text).toContain("return Response.json({ error: 'Forbidden' }, { status: 403 })");
  });

  it('requires editor privileges before broadcasting changes', async () => {
    const text = await source();
    expect(text).toContain("collaboratorRole === 'editor'");
    expect(text).toContain("if (action === 'broadcast_changes')");
    expect(text).toContain("return Response.json({ error: 'Editor access required' }, { status: 403 })");
  });
});
