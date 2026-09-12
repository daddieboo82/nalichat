// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('leave squad membership cleanup', () => {
  it('reports partial member cleanup instead of returning false success', async () => {
    const source = await readText('base44/functions/leaveSquad/entry.ts');

    expect(source).toContain('Promise.allSettled(');
    expect(source).toContain('failed_member_updates');
    expect(source).toContain('Squad ended, but member cleanup was incomplete. Please retry.');
    expect(source).not.toContain('.catch(() => {});');
  });
});
