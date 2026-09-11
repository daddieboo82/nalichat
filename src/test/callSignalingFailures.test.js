// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('call signaling failures', () => {
  it('propagates critical signal errors so calls cannot fake a ringing state', async () => {
    const hook = await readText('src/hooks/useCall.js');
    const engine = await readText('src/lib/callEngine.js');

    expect(hook).toContain('throw e;');
    expect(engine).toContain('await this.onSignal?.({ type: "offer"');
    expect(engine).toContain('await this.onSignal?.({ type: "answer"');
    expect(engine).toContain('Promise.resolve(');
    expect(engine).toContain('.catch(() => this._setState("failed"))');
  });
});
