import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase world visit memory',()=>{
  it('records a world when its mall hub is entered',async()=>{ const s=await read('pages/WorldHub.jsx'); expect(s).toContain("import { rememberWorldContext } from '@/lib/nalibaseWorldContext';"); expect(s).toContain('rememberWorldContext(worldId)'); });
  it('keeps a separate last-world memory for truthful return experiences',async()=>{ const s=await read('lib/nalibaseWorldContext.js'); expect(s).toContain("const WORLD_VISIT_KEY = 'nalibase.lastWorld';"); expect(s).toContain('sessionStorage.setItem(WORLD_VISIT_KEY, worldId)'); expect(s).toContain('export function getLastVisitedWorld()'); });
});
