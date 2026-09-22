import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase mobile world parity',()=>{
 it('exposes all six NaliBase worlds plus Plaza in mobile tabs',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); for (const id of ['connect','create','discover','share','visualize','compete']) expect(s).toContain(`/world/${id}`); expect(s).toContain('label: "Plaza"'); });
 it('maps SHARE storefronts back to the SHARE mobile tab',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('pathname.startsWith("/world/share")'); expect(s).toContain('pathname.startsWith("/files")'); expect(s).toContain('pathname.startsWith("/projects-summary")'); expect(s).toContain('return "/world/share"'); });
});
