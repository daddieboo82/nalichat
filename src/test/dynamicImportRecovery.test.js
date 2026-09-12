import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('dynamic import recovery', () => {
  it('recovers the Messages lazy route from transient module-fetch failures', async () => {
    const source = await readFile('src/App.jsx', 'utf8');
    expect(source).toContain('function lazyWithReloadRecovery');
    expect(source).toContain("const Messages = lazyWithReloadRecovery(() => import('@/pages/Messages'), 'messages');");
    expect(source).toMatch(/failed to fetch dynamically imported module/i);
    expect(source).toContain('window.location.reload()');
  });

  it('uses an app-specific Vite optimization cache for Base44 preview', async () => {
    const source = await readFile('vite.config.js', 'utf8');
    expect(source).toContain("cacheDir: 'node_modules/.vite-nalichat-v2'");
  });
});
