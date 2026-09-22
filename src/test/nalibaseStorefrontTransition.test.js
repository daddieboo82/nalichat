// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=(p)=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase storefront entry transition',()=>{
  it('mounts a brief world-aware storefront transition',async()=>{
    const layout=await read('components/layout/AppLayout.jsx');
    const transition=await read('components/layout/StorefrontEntryTransition.jsx');
    expect(layout).toContain('<StorefrontEntryTransition />');
    expect(transition).toContain('Entering storefront');
    expect(transition).toContain('{world.label} MALL');
    expect(transition).toContain('resolveWorldForLocation');
  });
});
