// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('NaliBase mall wayfinding',()=>{
  it('gives every world a directory, concourse, landmarks and anchored storefronts',async()=>{
    const source=await readFile(new URL('../pages/WorldHub.jsx',import.meta.url),'utf8');
    expect(source).toContain('Mall directory');
    expect(source).toContain('Follow the concourse to a storefront.');
    expect(source).toContain("href={'#storefront-'+i}");
    expect(source).toContain('id={"storefront-"+index}');
    expect(source).toContain("duration:18,repeat:Infinity");
  });
});
