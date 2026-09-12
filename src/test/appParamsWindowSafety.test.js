import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('app params window safety', () => {
  it('does not evaluate window.location defaults in non-browser contexts', async () => {
    const source = await readFile('src/lib/app-params.js', 'utf8');
    expect(source).toContain('const currentHref = isNode ? undefined : window.location.href;');
    expect(source).toContain('const currentOrigin = isNode ? undefined : window.location.origin;');
    expect(source).toContain('defaultValue: currentHref');
    expect(source).toContain('VITE_BASE44_APP_BASE_URL || currentOrigin');
    expect(source).not.toContain('defaultValue: window.location.href');
  });
});
