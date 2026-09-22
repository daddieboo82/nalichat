import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase global navigation',()=>{
 it('desktop navigation leads with all six world malls from the canonical registry',async()=>{ const s=await read('components/navigation/DesktopNav.jsx'); expect(s).toContain('NaliBase Worlds'); expect(s).toContain('WORLD_ORDER.map'); expect(s).toContain('WORLD_CONTEXTS[id].path'); });
 it('desktop shared storefronts preserve active mall identity',async()=>{ const s=await read('components/navigation/DesktopNav.jsx'); expect(s).toContain('resolveWorldForLocation(location.pathname, location.state?.fromWorld)'); });
 it('mobile bottom navigation keeps Plaza and all canonical malls one tap away',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('label: "Plaza"'); expect(s).toContain('...WORLD_ORDER.map'); expect(s).toContain('WORLD_CONTEXTS[id].path'); });
});
