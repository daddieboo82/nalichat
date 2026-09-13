import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('admin dashboard failed metrics', () => {
  it('does not render zero-valued metric cards when the metrics query failed', async () => {
    const s = await readFile('src/pages/AdminDashboard.jsx', 'utf8');
    expect(s).toContain('{!statsError && (');
    expect(s).toContain('Could not load dashboard metrics.');
  });
});
