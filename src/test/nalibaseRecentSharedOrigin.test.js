import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase recent shared storefront origin',()=>{
 it('prefers remembered mall context before canonical route mapping',async()=>{ const s=await read('components/navigation/RecentlyVisited.jsx'); const remembered=s.indexOf('getRememberedWorldForPath(path)'); const resolved=s.indexOf('getWorldForPath(path, rememberedWorld)'); expect(remembered).toBeGreaterThan(-1); expect(resolved).toBeGreaterThan(remembered); });
 it('does not mutate active mall merely by rendering recent buttons',async()=>{ const s=await read('components/navigation/RecentlyVisited.jsx'); expect(s).not.toContain('resolveWorldForLocation(path)'); });
});
