// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('shared file creation hardening', () => {
  it('validates method/account state and rejects malformed or oversized metadata', async () => {
    const source = await readText('base44/functions/createSharedFileRecord/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source.indexOf('user.is_banned')).toBeLessThan(
      source.indexOf('await consumeHourlyLimit'),
    );
    expect(source).toContain("typeof body?.name !== 'string'");
    expect(source).toContain("typeof body?.file_url !== 'string'");
    expect(source).toContain("typeof body.description !== 'string'");
    expect(source).toContain('name.length > 255');
    expect(source).toContain('description.length > 1000');
    expect(source).toContain('projectId.length > 200');
    expect(source).toContain('folderId.length > 200');
    expect(source).not.toContain('slice(0, 255)');
    expect(source).not.toContain('slice(0, 1000)');
  });
});
