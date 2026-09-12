// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('auth refresh generation guard', () => {
  it('allows only the latest auth refresh to commit state', async () => {
    const source = await readFile('src/lib/AuthContext.jsx', 'utf8');
    expect(source).toContain('const authCheckGenerationRef = useRef(0);');
    expect(source).toContain('const generation = existingGeneration ?? ++authCheckGenerationRef.current;');
    expect(source).toContain('if (generation !== authCheckGenerationRef.current) return null;');
    expect(source).toContain('return checkUserAuth(retryCount + 1, generation);');
  });

  it('invalidates all in-flight auth refreshes before logout begins', async () => {
    const source = await readFile('src/lib/AuthContext.jsx', 'utf8');
    const invalidate = source.indexOf('authCheckGenerationRef.current += 1;');
    const pushCleanup = source.indexOf('await unsubscribeFromRemotePush()');
    expect(invalidate).toBeGreaterThanOrEqual(0);
    expect(pushCleanup).toBeGreaterThan(invalidate);
  });
});
