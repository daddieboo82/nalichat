import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('mobile home direct entry', () => {
  it('does not automatically cover the mobile home with the welcome tour', async () => {
    const source = await readFile('src/pages/Home.jsx', 'utf8');
    expect(source).toContain('window.matchMedia?.("(max-width: 767px)")?.matches) return;');
    expect(source).toContain('setTimeout(() => setShowTour(true), 1500)');
    expect(source).toContain('onClick={() => setShowTour(true)}');
  });
});