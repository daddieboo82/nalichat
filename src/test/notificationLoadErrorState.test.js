import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('notification load state', () => {
  it('does not show a failed notification request as an empty inbox', async () => {
    const s = await readFile('src/components/notifications/NotificationBell.jsx', 'utf8');
    expect(s).toContain('const [loadError, setLoadError] = useState(false);');
    expect(s).toContain("Couldn't load notifications");
    expect(s).toContain('onClick={() => user?.id && void load(user.id)}');
    expect(s).toContain('setLoadError(true)');
    expect(s).toContain('setLoadError(false)');
  });
});
