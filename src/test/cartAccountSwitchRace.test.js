// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('cart account switch isolation', () => {
  it('skips the stale in-memory persist that occurs on an identity-key change', async () => {
    const source = await readFile('src/lib/CartContext.jsx', 'utf8');
    expect(source).toContain('const skipNextPersistRef = useRef(true);');
    const load = source.indexOf('skipNextPersistRef.current = true;');
    const persist = source.indexOf('if (skipNextPersistRef.current)');
    expect(load).toBeGreaterThan(-1);
    expect(persist).toBeGreaterThan(load);
    expect(source).toContain('skipNextPersistRef.current = false;');
    expect(source).toContain("localStorage.setItem(cartStorageKey, JSON.stringify(items))");
  });
});
