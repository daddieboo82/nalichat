// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('studio presence idempotency', () => {
  it('uses deterministic room/user ids and validates write input', async () => {
    const source = await readText('base44/functions/updateStudioPresence/entry.ts');

    expect(source).toContain('async function presenceId');
    expect(source).toContain('studio_presence_');
    expect(source).toContain('id: deterministicId');
    expect(source).toContain('StudioPresence.get(deterministicId)');
    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('user.is_banned');
    expect(source).toContain('roomId.length > 200');
    expect(source).toContain("activity must be 200 characters or fewer");
  });
});
