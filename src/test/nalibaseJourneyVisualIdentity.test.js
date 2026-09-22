import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase journey return visual identity',()=>{
 it('gives every world a Plaza-safe visual identity',async()=>{ const s=await read('lib/nalibaseWorldContext.js'); expect((s.match(/plazaGradient:/g)||[]).length).toBe(6); });
 it('uses remembered world identity on the continuation portal',async()=>{ const s=await read('pages/Home.jsx'); expect(s).toContain('${lastVisitedWorld.plazaGradient}'); expect(s).toContain('bg-gradient-to-br'); });
});
