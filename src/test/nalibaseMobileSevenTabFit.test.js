import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase mobile bottom nav fit',()=>{
 it('keeps labels compact on narrow phones with five simple tabs',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('text-[11px]'); expect(s).toContain('flex-1 flex flex-col'); });
 it('keeps every tab equal width for the five destinations',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('relative flex-1 flex flex-col'); });
});