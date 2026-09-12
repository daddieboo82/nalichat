// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('profile settings account-state isolation', () => {
  it('guards Settings form state with the user who hydrated it', async () => {
    const source = await readFile('src/pages/Settings.jsx', 'utf8');
    expect(source).toContain('const [formOwnerId, setFormOwnerId] = useState(null);');
    expect(source).toContain('setFormOwnerId(user.id);');
    expect(source).toContain('if (formOwnerId !== user.id)');
    expect(source).toContain('setShowWizard(false);');
  });

  it('guards editable Profile state with the active user', async () => {
    const source = await readFile('src/pages/Profile.jsx', 'utf8');
    expect(source).toContain('const [formOwnerId, setFormOwnerId] = useState(null);');
    expect(source).toContain('setFormOwnerId(user.id);');
    expect(source).toContain('setEditing(false);');
    expect(source).toContain('if (isMe && formOwnerId !== user.id)');
  });
});
