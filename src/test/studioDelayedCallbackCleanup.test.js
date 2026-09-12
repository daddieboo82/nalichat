// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('studio delayed callback cleanup', () => {
  it('cancels stale count-in completion callbacks', async () => {
    const source = await readText('src/components/studio/CountInIndicator.jsx');
    expect(source).toContain('const completionTimerRef = useRef(null);');
    expect(source).toContain('if (completionTimerRef.current) clearTimeout(completionTimerRef.current);');
    expect(source).toContain('completionTimerRef.current = null;');
  });

  it('cleans Bounce completion redirects on unmount', async () => {
    const source = await readText('src/components/studio/BounceDialog.jsx');
    expect(source).toContain('const finishTimerRef = useRef(null);');
    expect(source).toContain('if (finishTimerRef.current) clearTimeout(finishTimerRef.current);');
    expect(source).toContain('finishTimerRef.current = setTimeout');
  });
});
