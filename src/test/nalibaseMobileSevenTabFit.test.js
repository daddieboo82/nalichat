import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase seven-tab mobile fit',()=>{
 it('keeps labels compact on narrow phones after adding SHARE',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('text-[10px] min-[390px]:text-[11px]'); expect(s).toContain('truncate px-px'); });
 it('keeps every tab equal width for the seven destinations',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('relative flex-1 flex flex-col'); });
});
