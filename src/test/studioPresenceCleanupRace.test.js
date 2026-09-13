// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('studio presence cleanup', () => {
  it('clears presence immediately on cleanup instead of scheduling a stale delayed clear', async () => {
    const source = await readText('src/hooks/useStudioPresence.js');
    expect(source).toContain('void base44.functions.invoke("updateStudioPresence"');
    expect(source).toContain('action: "clear"');
    expect(source).toContain('res?.data?.action !== "clear"');
    expect(source).toContain('res?.data?.userId !== expectedUserId');
    expect(source).toContain('res?.data?.roomId !== roomId');
    expect(source).toContain('!Number.isInteger(res?.data?.cleanup_failures)');
    expect(source).toContain('Studio presence clear was not confirmed.');
    expect(source).not.toContain('setTimeout(() => {\n        base44.functions.invoke("updateStudioPresence"');
    expect(source).not.toContain('}, 2000);');
    it('binds heartbeat confirmation to the current user and room', async () => {
    const backend = await readText('base44/functions/updateStudioPresence/entry.ts');
    const hook = await readText('src/hooks/useStudioPresence.js');
    expect(backend).toContain("action: 'heartbeat'");
    expect(backend).toContain("action: 'clear'");
    expect(backend).toContain('userId: user.id');
    expect(hook).toContain('res?.data?.userId !== me.id');
    expect(hook).toContain('res?.data?.roomId !== roomId');
  });
});
});
