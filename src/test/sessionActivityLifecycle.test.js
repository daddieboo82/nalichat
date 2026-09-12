// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('session activity lifecycle', () => {
  it('checks persisted inactivity before refreshing the activity timestamp', async () => {
    const source = await readText('src/App.jsx');

    const readExisting = source.indexOf("const lastActive = safeLocalStorageGet('last_activity')");
    const timeoutCheck = source.indexOf('Date.now() - parsedLastActive > 24 * 60 * 60 * 1000');
    const initialize = source.indexOf('if (!Number.isFinite(parsedLastActive)) updateActivity();');

    expect(readExisting).toBeGreaterThanOrEqual(0);
    expect(timeoutCheck).toBeGreaterThan(readExisting);
    expect(initialize).toBeGreaterThan(timeoutCheck);
    expect(source).not.toContain("localStorage.setItem('last_activity', Date.now().toString());\n    const checkActivity");
  });

  it('removes the capture-phase play listener with matching capture semantics', async () => {
    const source = await readText('src/App.jsx');

    expect(source).toContain("window.addEventListener('play', updateActivity, { passive: true, capture: true });");
    expect(source).toContain("window.removeEventListener('play', updateActivity, true);");
  });
});
