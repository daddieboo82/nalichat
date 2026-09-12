// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('product analytics foreground accounting', () => {
  it('closes foreground intervals explicitly on visibility changes', async () => {
    const source = await readFile('src/lib/productAnalytics.js', 'utf8');
    expect(source).toContain('let foregroundSince = null;');
    expect(source).toContain('function accrueForegroundUntil');
    expect(source).toContain('if (foregroundSince != null) s.engagedMs += Math.max(0, t - foregroundSince);');
    expect(source).toContain('foregroundSince = null;');
    expect(source).not.toContain('document.visibilityState === "visible" && t - s.lastActiveAt < 60_000');
  });
});
