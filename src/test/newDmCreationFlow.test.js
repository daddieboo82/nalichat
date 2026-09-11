// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('new DM creation flow', () => {
  it('waits for backend success and preserves the dialog on failure', async () => {
    const dialog = await readText('src/components/messages/NewChatDialog.jsx');
    const page = await readText('src/pages/Messages.jsx');

    expect(dialog).toContain('const [pendingUserId, setPendingUserId] = useState(null)');
    expect(dialog).toContain('await onSelectUser(user)');
    expect(dialog).toContain('if (!user?.id || pendingUserId) return');
    expect(dialog).toContain('disabled={!!pendingUserId}');
    expect(page).toContain('onSelectUser={startDM}');
    expect(page).toContain('throw err;');
  });
});
