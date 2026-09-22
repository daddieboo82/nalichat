// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase central plaza presence',()=>{
 it('presents the authenticated hub as a truthful central plaza',async()=>{ const s=await read('pages/Home.jsx'); expect(s).toContain('Central Plaza · Six worlds'); expect(s).toContain('<MapPin'); expect(s).not.toContain('Central Plaza · All six malls open'); });
 it('keeps all six canonical mall entrances in the plaza',async()=>{ const s=await read('pages/Home.jsx'); expect(s).toContain('PLAZA_WORLDS.map'); expect(s).toContain('WORLD_ORDER.map'); expect(s).toContain('WORLD_CONTEXTS[id].path'); });
});
