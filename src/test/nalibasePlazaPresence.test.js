// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase central plaza presence',()=>{
 it('presents the authenticated hub as a live central plaza',async()=>{ const s=await read('pages/Home.jsx'); expect(s).toContain('Central Plaza · All six malls open'); expect(s).toContain('animate-ping'); });
 it('keeps all six mall entrances in the plaza',async()=>{ const s=await read('pages/Home.jsx'); for(const w of ['connect','create','discover','share','visualize','compete']) expect(s).toContain('/world/'+w); });
});
