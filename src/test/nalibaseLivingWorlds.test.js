// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('NaliBase living worlds',()=>{
  it('gives all six malls a world pulse and internal evolution surface',async()=>{
    const source=await readFile(new URL('../pages/WorldHub.jsx',import.meta.url),'utf8');
    expect(source.split('scene:[').length - 1).toBe(6);
    expect(source).toContain('World atmosphere');
    expect(source).toContain('Always evolving');
    expect(source).toContain('This world grows from within.');
    expect(source).toContain('Nali AI can add subtle improvements');
  });
});
