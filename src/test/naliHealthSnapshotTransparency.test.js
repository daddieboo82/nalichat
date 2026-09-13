import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Nali health snapshot transparency', () => {
  it('reports sample truncation and paginates admin recipients', async () => {
    const s = await readFile('base44/functions/naliHealthCheck/entry.ts', 'utf8');
    expect(s).toContain('npm:@base44/sdk@0.8.44');
    expect(s).toContain('async function listAllRows(');
    expect(s).toContain("{ role: 'admin' }");
    expect(s).toContain('const snapshotTruncated = {');
    expect(s).toContain('const partialSnapshot = Object.values(snapshotTruncated).some(Boolean)');
    expect(s).toContain('lightweight recent-record sample, not a full-database audit');
    expect(s).toContain('partialSnapshot,');
    expect(s).toContain('snapshotTruncated,');
  });
});
