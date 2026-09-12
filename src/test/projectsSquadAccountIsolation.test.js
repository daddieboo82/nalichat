// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('projects and squad account-state isolation', () => {
  it('guards project summary data and invite state by active user', async () => {
    const source = await readFile('src/pages/ProjectsSummary.jsx', 'utf8');
    expect(source).toContain('const [dataOwnerId, setDataOwnerId] = useState(null);');
    expect(source).toContain('setDataOwnerId(requestedUserId);');
    expect(source).toContain('if (user?.id && dataOwnerId !== user.id)');
    expect(source).toContain('setInviteLinks({});');
    expect(source).toContain('setNewProjectDescription("");');
  });

  it('clears squad partner/invite state when identity changes', async () => {
    const source = await readFile('src/pages/Squad.jsx', 'utf8');
    expect(source).toContain('const [stateOwnerId, setStateOwnerId] = useState(null);');
    expect(source).toContain('setStateOwnerId(requestedUserId);');
    expect(source).toContain('setSquad(null);');
    expect(source).toContain('setProgress(null);');
    expect(source).toContain('setCredits(0);');
    expect(source).toContain('if (user?.id && stateOwnerId !== user.id)');
  });
});
