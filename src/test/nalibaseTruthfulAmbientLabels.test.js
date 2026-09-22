import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase truthful ambient labels',()=>{
 it('does not present static world scene copy as a live pulse',async()=>{ const s=await read('pages/WorldHub.jsx'); expect(s).toContain('World atmosphere'); expect(s).not.toContain('World pulse'); });
 it('does not imply operational mall status without live status data',async()=>{ const s=await read('pages/Home.jsx'); expect(s).toContain('Central Plaza · Six worlds'); expect(s).not.toContain('All six malls open'); });
});
