// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase Central Plaza spatial map',()=>{
 it('grounds authenticated users in the plaza above the direct tool links',async()=>{ const s=await read('pages/Home.jsx'); expect(s).toContain('You are here · Central Plaza'); expect(s).toContain('aria-label="NaliBase Central Plaza map"'); expect(s).toContain('const PLAZA_WORLDS = WORLD_ORDER.map'); expect(s).toContain('storefronts: WORLD_CONTEXTS[id].storefronts'); });
});
