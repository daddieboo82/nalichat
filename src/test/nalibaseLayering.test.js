// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase immersive shell layering',()=>{
 it('keeps storefront content above ambient world atmosphere',async()=>{ const s=await read('components/layout/AppLayout.jsx'); expect(s).toContain('relative z-10 flex-1 overflow-hidden'); expect(s).not.toContain('overflow-hidden">\\\\n'); });
});
