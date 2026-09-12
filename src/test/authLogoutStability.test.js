import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('auth logout callback stability', () => {
  it('memoizes logout so inactivity listeners do not churn on auth renders', async () => {
    const source = await readFile('src/lib/AuthContext.jsx', 'utf8');
    expect(source).toContain('const logout = useCallback(async () => {');
    expect(source).toContain('}, [queryClient]);');
  });
});
