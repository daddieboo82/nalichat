import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase Plaza journey return',()=>{
 it('presents last-world memory as a continuation action',async()=>{ const s=await read('pages/Home.jsx'); expect(s).toContain('Continue your journey'); expect(s).toContain('Return to {lastVisitedWorld.label}'); expect(s).toContain('{lastVisitedWorld.name}'); });
 it('still requires truthful account-scoped history',async()=>{ const s=await read('pages/Home.jsx'); expect(s).toContain('getLastVisitedWorld(user.id)'); expect(s).toContain('{lastVisitedWorld && ('); });
});
