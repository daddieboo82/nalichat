// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('content reporting moderation gates', () => {
  it('keeps reporting POST-only and blocks banned or timed-out accounts', async () => {
    const source = await readText('base44/functions/reportContent/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('reporter.is_banned');
    expect(source).toContain('reporter.timeout_until');
    expect(source).toContain("error: 'timed_out'");
    expect(source.indexOf("req.method !== 'POST'")).toBeLessThan(
      source.indexOf('createClientFromRequest(req)'),
    );
  });
});
