import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Explore auth redirect', () => {
  it('uses the centralized deep-link-preserving login redirect', async () => {
    const s = await readFile('src/pages/Explore.jsx', 'utf8');
    expect(s).toContain('navigateToLogin');
    expect(s).toContain('typeof base44?.auth?.redirectToLogin === "function"');
    expect((s.match(/navigateToLogin\(\);/g) || []).length).toBe(2);
  });
});
