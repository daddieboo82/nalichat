import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase recent shared storefront origin',()=>{
 it('persists the mall origin at storefront visit time',async()=>{ const s=await read('components/navigation/RecentlyVisited.jsx'); expect(s).toContain('currentWorldId = ""'); expect(s).toContain('fromWorld: WORLD_CONTEXTS[currentWorldId] ? currentWorldId : ""'); expect(s).toContain('const rememberedWorld = fromWorld || getRememberedWorldForPath(path)'); });
 it('passes the resolved current mall from the mobile header',async()=>{ const s=await read('components/navigation/MobileHeader.jsx'); expect(s).toContain("currentWorldId={activeWorld?.id || ''}"); });
 it('migrates legacy path strings without inventing a historical origin',async()=>{ const s=await read('components/navigation/RecentlyVisited.jsx'); expect(s).toContain('typeof item === "string"'); expect(s).toContain('? { path: item, fromWorld: "" }'); });
 it('does not mutate active mall merely by rendering recent buttons',async()=>{ const s=await read('components/navigation/RecentlyVisited.jsx'); expect(s).not.toContain('resolveWorldForLocation(path)'); });
});
