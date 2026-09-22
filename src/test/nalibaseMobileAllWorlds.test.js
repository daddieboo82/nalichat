import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase mobile world parity',()=>{
 it('builds all six world tabs plus Plaza from the canonical registry',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('label: "Plaza"'); expect(s).toContain('...WORLD_ORDER.map'); expect(s).toContain('path: WORLD_CONTEXTS[id].path'); });
 it('delegates storefront ownership to the canonical world resolver',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('getWorldForPath(pathname, preferredWorld)'); expect(s).toContain('return world?.path || null'); });
});
