import { describe,expect,it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('WorldHub canonical identity',()=>{
 it('takes mall title and world name from canonical registry',async()=>{ const s=await read('pages/WorldHub.jsx'); expect(s).toContain('title: canonicalWorld.label'); expect(s).toContain('eyebrow: canonicalWorld.name'); for(const duplicated of ["title:'CONNECT'","title:'CREATE'","title:'DISCOVER'","title:'SHARE'","title:'VISUALIZE'","title:'COMPETE'","eyebrow:'NaliChat World'","eyebrow:'NaliStudio World'"]) expect(s).not.toContain(duplicated); });
});
