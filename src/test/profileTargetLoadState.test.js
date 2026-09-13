import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('public profile load state', () => {
  it('does not spin forever when a target profile is missing or fails to load', async () => {
    const s = await readFile('src/pages/Profile.jsx', 'utf8');
    expect(s).toContain('isLoading: targetUserLoading');
    expect(s).toContain('isError: targetUserError');
    expect(s).toContain('Profile unavailable');
    expect(s).toContain('onClick={() => void refetchTargetUser()}');
  });
});
