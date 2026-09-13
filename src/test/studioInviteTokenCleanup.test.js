import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio invite token cleanup', () => {
  it('removes an accepted invite token from the address bar using replace navigation', async () => {
    const s = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(s).toContain('const [searchParams, setSearchParams] = useSearchParams();');
    expect(s).toContain('nextParams.delete("invite");');
    expect(s).toContain('setSearchParams(nextParams, { replace: true });');
  });
});
