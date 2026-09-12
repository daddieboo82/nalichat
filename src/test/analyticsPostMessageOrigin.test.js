// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('analytics iframe relay privacy', () => {
  it('does not post analytics events to wildcard parent origins', async () => {
    const source = await readFile('src/App.jsx', 'utf8');
    expect(source).toContain('const analyticsRelayOrigin = (() => {');
    expect(source).toContain("host.includes('preview')");
    expect(source).toContain("host.includes('sandbox')");
    expect(source).toContain('new URL(document.referrer).origin');
    expect(source).toContain('}, analyticsRelayOrigin);');
    expect(source).not.toContain("}, '*');");
  });

  it('disables the relay on ordinary production hosts', async () => {
    const source = await readFile('src/App.jsx', 'utf8');
    expect(source).toContain('if (!relayAllowed) return null;');
    expect(source).toContain('if (analyticsRelayOrigin)');
  });
});
