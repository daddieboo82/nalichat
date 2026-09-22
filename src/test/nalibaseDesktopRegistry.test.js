import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase desktop world registry',()=>{
 it('builds desktop world entrances from the canonical registry',async()=>{ const s=await read('components/navigation/DesktopNav.jsx'); expect(s).toContain('WORLD_CONTEXTS, WORLD_ORDER'); expect(s).toContain('items: WORLD_ORDER.map'); expect(s).toContain('path: WORLD_CONTEXTS[id].path'); });
 it('keeps active storefront identity on the shared resolver',async()=>{ const s=await read('components/navigation/DesktopNav.jsx'); expect(s).toContain('resolveWorldForLocation(location.pathname, location.state?.fromWorld)'); });
});
