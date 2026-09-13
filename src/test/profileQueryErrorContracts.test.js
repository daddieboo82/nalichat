import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('profile query error contracts', () => {
  it('throws resolved backend errors so React Query reaches the error UI', async () => {
    const s = await readFile('src/pages/Profile.jsx', 'utf8');
    expect((s.match(/if \(res\?\.data\?\.error\) throw new Error\(res\.data\.error\);/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(s).toContain('listPublicAchievements');
    expect(s).toContain('listPublicUsers');
  });
});
