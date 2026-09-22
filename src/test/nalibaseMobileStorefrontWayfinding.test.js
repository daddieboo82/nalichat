// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase mobile storefront wayfinding',()=>{
 it('keeps sibling storefront navigation available on mobile',async()=>{ const s=await read('components/layout/WorldContinuityBar.jsx'); expect(s).toContain('[scrollbar-width:none]'); expect(s).not.toContain('overflow-x-auto sm:flex'); expect(s).toContain('world.storefronts'); });
});
