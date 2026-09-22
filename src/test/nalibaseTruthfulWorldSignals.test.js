// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase truthful world signals',()=>{
 it('does not label ambient scene copy as real-time live activity',async()=>{ const s=await read('pages/WorldHub.jsx'); expect(s).toContain('World signal'); expect(s).not.toContain('>Live</span>'); });
});
