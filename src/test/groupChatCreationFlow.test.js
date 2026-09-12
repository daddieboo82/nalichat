// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('group chat creation flow', () => {
  it('keeps dialog state on failure and blocks duplicate submits', async () => {
    const dialog = await readText('src/components/messages/GroupChatDialog.jsx');
    const page = await readText('src/pages/Messages.jsx');

    expect(dialog).toContain('const [isCreating, setIsCreating] = useState(false)');
    expect(dialog).toContain('if (!trimmedName || selected.length < 1 || isCreating) return');
    expect(dialog).toContain('await onCreate');
    expect(dialog).toContain('setIsCreating(true)');
    expect(dialog).toContain('setIsCreating(false)');
    expect(dialog).toContain('Creating...');
    expect(page).toContain('throw err;');
  });
});
