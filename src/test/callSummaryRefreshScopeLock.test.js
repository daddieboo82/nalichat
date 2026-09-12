// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('call summary refresh scope lock', () => {
  it('only suppresses duplicate refreshes for the same active scope', async () => {
    const source = await readText('src/hooks/useCallSummary.js');
    expect(source).toContain('const refreshInFlightScopeRef = useRef(null);');
    expect(source).toContain('if (refreshInFlightScopeRef.current === requestScopeAtStart) return null;');
    expect(source).toContain('refreshInFlightScopeRef.current = requestScopeAtStart;');
    expect(source).toContain('if (refreshInFlightScopeRef.current === requestScopeAtStart) {');
    expect(source).not.toContain('refreshInFlightRef');
  });
});
