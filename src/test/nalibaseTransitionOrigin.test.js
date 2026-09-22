// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase origin-aware storefront transitions',()=>{
 it('treats the same storefront entered from different malls as distinct transitions',async()=>{ const s=await read('components/layout/StorefrontEntryTransition.jsx'); expect(s).toContain('seen.has(`${world.id}:${pathname}`)'); expect(s).toContain('seen.add(`${world.id}:${pathname}`)'); });
});
