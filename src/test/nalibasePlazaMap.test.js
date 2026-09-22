// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase Central Plaza spatial map',()=>{
 it('grounds authenticated users in the plaza before the six mall entrances',async()=>{ const s=await read('pages/Home.jsx'); expect(s).toContain('You are here · Central Plaza'); expect(s).toContain('aria-label="NaliBase Central Plaza map"'); for(const id of ['connect','create','discover','share','visualize','compete']) expect(s).toContain(`/world/${id}`); });
});
