import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('404 theme support', () => {
  it('uses application theme tokens instead of fixed light slate colors', async () => {
    const s = await readFile('src/lib/PageNotFound.jsx', 'utf8');
    expect(s).toContain('bg-background');
    expect(s).toContain('text-foreground');
    expect(s).toContain('text-muted-foreground');
    expect(s).not.toContain('bg-slate-50');
    expect(s).not.toContain('bg-white');
  });
});
