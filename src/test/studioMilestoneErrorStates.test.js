import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio milestone error states', () => {
  it('distinguishes failed loads from empty milestones and surfaces mutation errors', async () => {
    const s = await readFile('src/components/studio/MilestonesPanel.jsx', 'utf8');
    expect(s).toContain('isLoading, isError, refetch');
    expect(s).toContain("Couldn't load milestones");
    expect(s).toContain("Couldn't add milestone. Please try again.");
    expect(s).toContain("Couldn't update milestone. Please try again.");
    expect(s).toContain("Couldn't delete milestone. Please try again.");
  });
});
