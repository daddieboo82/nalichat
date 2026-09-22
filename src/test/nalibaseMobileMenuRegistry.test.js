import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase mobile mall menu registry',()=>{
 it('builds the drawer mall list from the canonical world registry',async()=>{ const s=await read('components/navigation/MobileHeader.jsx'); expect(s).toContain('WORLD_CONTEXTS, WORLD_ORDER'); expect(s).toContain('items: WORLD_ORDER.map'); expect(s).toContain('path: WORLD_CONTEXTS[id].path'); expect(s).toContain('desc: WORLD_CONTEXTS[id].menuDescription'); });
 it('keeps each canonical world equipped with drawer copy',async()=>{ const s=await read('lib/nalibaseWorldContext.js'); for (const id of ['connect','create','discover','share','visualize','compete']) expect(s).toMatch(new RegExp(`${id}: \\{[^\\n]+menuDescription:`)); });
});
