import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase truthful ambient labels',()=>{
 it('does not imply operational mall status without live status data',async()=>{ const s=await read('pages/Home.jsx'); expect(s).toContain('Central Plaza · Six worlds'); expect(s).not.toContain('All six malls open'); });
});
