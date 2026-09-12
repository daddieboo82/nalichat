// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Files account state isolation', () => {
  it('clears private file UI state whenever the active account changes', async () => {
    const source = await readFile('src/pages/Files.jsx', 'utf8');
    expect(source).toContain('}, [currentUser?.id]);');
    expect(source).toContain('setSelectedIds([]);');
    expect(source).toContain('setCurrentFolderId(null);');
    expect(source).toContain('setShowMoveFolder(false);');
    expect(source).toContain('setFileToEdit(null);');
    expect(source).toContain('setEditFormData({ name: "", tags: "", description: "" });');
    expect(source).toContain('if (fileInputRef.current) fileInputRef.current.value = "";');
  });
});
