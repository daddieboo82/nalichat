import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase mobile recent storefront origin',()=>{
 it('resolves a world for recent storefront navigation',async()=>{ const s=await read('components/navigation/RecentlyVisited.jsx'); expect(s).toContain('getRememberedWorldForPath(path)'); expect(s).toContain('getWorldForPath(path, rememberedWorld)'); expect(s).toContain("onNavigate(path, world?.id || '')"); });
 it('passes resolved world origin through mobile navigation state',async()=>{ const s=await read('components/navigation/MobileHeader.jsx'); expect(s).toContain("const handleNavigate = (dest, fromWorld = '')"); expect(s).toContain('state: { fromWorld }'); });
});
