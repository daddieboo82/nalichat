// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('app shell storage resilience', () => {
  it('uses safe localStorage helpers for app-shell activity and signup tracking', async () => {
    const source = await readText('src/App.jsx');
    expect(source).toContain('function safeLocalStorageGet(key)');
    expect(source).toContain("const lastActive = safeLocalStorageGet('last_activity')");
    expect(source).toContain("safeLocalStorageSet('last_activity', Date.now().toString())");
    expect(source).not.toContain("localStorage.getItem('last_activity')");
  });

  it('keeps Ask Nali hint working without sessionStorage', async () => {
    const source = await readText('src/components/AskNaliHint.jsx');
    expect(source).toContain('function sessionGet(key)');
    expect(source).toContain('sessionGet("nali_hint_dismissed")');
    expect(source).toContain('sessionSet("nali_hint_dismissed", "1")');
  });

  it('keeps daily recommendation dismissal working without sessionStorage', async () => {
    const source = await readText('src/components/home/DailyRecommendation.jsx');
    expect(source).toContain('function sessionGet(key)');
    expect(source).toContain('if (sessionGet(key))');
    expect(source).toContain('sessionSet(key, "1")');
  });
});
