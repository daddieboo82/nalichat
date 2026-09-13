import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('follow-up reminder load state', () => {
  it('does not render a failed reminder request as an empty conversation', async () => {
    const s = await readFile('src/components/messages/FollowUpReminderDialog.jsx', 'utf8');
    expect(s).toContain('const [loadError, setLoadError] = useState(false);');
    expect(s).toContain("Couldn't load reminders");
    expect(s).toContain('Retry before assuming this conversation has no reminders.');
    expect(s).toContain('setLoadError(true)');
    expect(s).toContain('setLoadError(false)');
  });
});
