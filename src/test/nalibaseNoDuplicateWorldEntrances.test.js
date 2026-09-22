import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase canonical world entrances',()=>{
 it('uses the remembered world registry path for Plaza journey return',async()=>{ const s=await read('pages/Home.jsx'); expect(s).toContain('to={lastVisitedWorld.path}'); expect(s).not.toContain('to={`/world/${lastVisitedWorld.id}`}'); });
 it('keeps literal six world entrance definitions in the registry, not navigation surfaces',async()=>{ const files=['pages/Home.jsx','components/navigation/MobileHeader.jsx','components/navigation/MobileNav.jsx','components/navigation/DesktopNav.jsx']; for (const file of files) { const s=await read(file); for (const id of ['connect','create','discover','share','visualize','compete']) expect(s).not.toContain(`path: "/world/${id}"`); } });
});
