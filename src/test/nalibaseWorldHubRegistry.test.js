import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase WorldHub canonical storefront routing',()=>{
 it('uses canonical world contexts for storefront paths',async()=>{ const s=await read('pages/WorldHub.jsx'); expect(s).toContain('WORLD_CONTEXTS'); expect(s).toContain('const canonicalWorld=WORLD_CONTEXTS[worldId]'); expect(s).toContain('to={canonicalWorld.storefronts[index].path}'); });
 it('does not duplicate storefront route literals inside the visual world configuration',async()=>{ const s=await read('pages/WorldHub.jsx'); for(const path of ['/messages','/studio','/explore','/files','/music-video-generator','/challenges']) expect(s).not.toContain(`'${path}'`); });
});
