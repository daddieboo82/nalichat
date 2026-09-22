// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('authenticated NaliBase hub',()=>{
  it('keeps legacy marketing below the hero anonymous-only',async()=>{
    const source=await readFile(new URL('../pages/Home.jsx',import.meta.url),'utf8');
    const pillar=source.indexOf('{/* — Pillar pills — */}');
    const gate=source.lastIndexOf('{!user && <>',pillar);
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(pillar);
    expect(source).toContain('Where do you want to go?');
    expect(source).toContain('/world/connect');
    expect(source).toContain('/world/compete');
  });
});
