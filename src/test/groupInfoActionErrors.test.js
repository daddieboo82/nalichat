// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('group info action errors', () => {
  it('handles rename, leave, and private-DM failures without false success', async () => {
    const source = await readText('src/components/messages/GroupInfoPanel.jsx');

    expect(source).toContain('const [isSavingName, setIsSavingName] = useState(false)');
    expect(source).toContain('const [isLeaving, setIsLeaving] = useState(false)');
    expect(source).toContain('const [pendingDmUserId, setPendingDmUserId] = useState(null)');
    expect(source).toContain('toast.error("Couldn\'t rename the group. Please try again.")');
    expect(source).toContain('toast.error("Couldn\'t leave the group. Please try again.")');
    expect(source).toContain('await onStartDM(user)');
    expect(source).toContain('disabled={isLeaving}');
    expect(source).toContain('disabled={!!pendingDmUserId}');
  });
});
