import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase recently visited world',()=>{
  it('shows only truthful session-backed world history in the Plaza',async()=>{ const s=await read('pages/Home.jsx'); expect(s).toContain('getLastVisitedWorld(user.id)'); expect(s).toContain('Recently visited'); expect(s).toContain('lastVisitedWorld.title'); expect(s).toContain('`/world/${lastVisitedWorld.id}`'); });
  it('does not invent a fallback recent world',async()=>{ const s=await read('lib/nalibaseWorldContext.js'); expect(s).toContain("return WORLD_CONTEXTS[worldId] ? { id: worldId, ...WORLD_CONTEXTS[worldId] } : null"); });
});
