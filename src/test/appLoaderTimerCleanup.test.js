// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('AppLoader timer cleanup', () => {
  it('cleans both loading and completion timers on unmount', async () => {
    const source = await readText('src/components/layout/AppLoader.jsx');
    expect(source).toContain('const loadingTimer = window.setTimeout');
    expect(source).toContain('completionTimer = window.setTimeout(onDone, 60)');
    expect(source).toContain('window.clearTimeout(loadingTimer)');
    expect(source).toContain('window.clearTimeout(completionTimer)');
  });
});
