// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('call summary stale response protection', () => {
  it('drops get/list results after the active call or conversation changes', async () => {
    const source = await readText('src/hooks/useCallSummary.js');
    expect(source).toContain('const requestScopeRef = useRef("");');
    expect(source).toContain('const requestScopeAtStart = requestScopeRef.current;');
    expect(source).toContain('if (requestScopeRef.current !== requestScopeAtStart) return null;');
    expect(source).toContain('let cancelled = false;');
    expect(source).toContain('if (!cancelled && conversation?.id === requestedConversationId) applyData(next);');
    expect(source).toContain('return () => {\n      cancelled = true;\n    };');
  });
});
