// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('project creation hardening', () => {
  it('validates method/account state and rejects oversized input before create', async () => {
    const source = await readText('base44/functions/createProject/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source.indexOf('user.is_banned')).toBeLessThan(
      source.indexOf('await consumeHourlyLimit'),
    );
    expect(source).toContain("typeof body.title !== 'string'");
    expect(source).toContain("typeof body.description !== 'string'");
    expect(source).toContain('title.length > 200');
    expect(source).toContain('description.length > 3000');
    expect(source).toContain('status: 413');
  });
});
