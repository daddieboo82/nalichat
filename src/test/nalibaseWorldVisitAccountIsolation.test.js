import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase world visit account isolation',()=>{
  it('scopes recent-world memory by account',async()=>{ const s=await read('lib/nalibaseWorldContext.js'); expect(s).toContain("const visitKeyFor = (userId='') => `${WORLD_VISIT_KEY}:${userId || 'anonymous'}`"); expect(s).toContain('sessionStorage.setItem(visitKeyFor(userId), worldId)'); expect(s).toContain('sessionStorage.getItem(visitKeyFor(userId))'); });
  it('passes the authenticated account through the world hub and Plaza',async()=>{ const w=await read('pages/WorldHub.jsx'); const h=await read('pages/Home.jsx'); expect(w).toContain('rememberWorldContext(worldId,user?.id)'); expect(h).toContain('getLastVisitedWorld(user.id)'); });
});
