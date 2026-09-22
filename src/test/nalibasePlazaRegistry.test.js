import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase Central Plaza world registry',()=>{
 it('builds authenticated Plaza portals from the canonical world registry',async()=>{ const s=await read('pages/Home.jsx'); expect(s).toContain('WORLD_CONTEXTS, WORLD_ORDER'); expect(s).toContain('const PLAZA_WORLDS = WORLD_ORDER.map'); expect(s).toContain('WORLD_CONTEXTS[id].path'); expect(s).toContain('WORLD_CONTEXTS[id].plazaGradient'); expect(s).toContain('PLAZA_WORLDS.map'); });
 it('does not duplicate authenticated portal paths inline',async()=>{ const s=await read('pages/Home.jsx'); const block=s.slice(s.indexOf('const PLAZA_WORLDS'), s.indexOf('const features')); expect(block).not.toContain('path: "/world/'); });
});
