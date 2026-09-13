import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Analytics load state', () => {
  it('does not render failed analytics queries as legitimate zero totals', async () => {
    const s = await readFile('src/pages/Analytics.jsx', 'utf8');
    expect(s).toContain('isLoading, isError, refetch');
    expect(s).toContain('Analytics unavailable');
    expect(s).toContain("won't show misleading zero totals");
    expect(s).toContain('onClick={() => void refetch()}');
  });
});
