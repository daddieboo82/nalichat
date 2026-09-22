import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase mobile header world identity',()=>{
 it('resolves shared storefront world using navigation origin',async()=>{ const s=await read('components/navigation/MobileHeader.jsx'); expect(s).toContain('resolveWorldForLocation(path, location.state?.fromWorld)'); });
 it('shows mall identity on storefront titles without duplicating it on world hubs',async()=>{ const s=await read('components/navigation/MobileHeader.jsx'); expect(s).toContain('`${activeWorld.label} · ${baseTitle}`'); expect(s).toContain("!path.startsWith('/world/')"); });
});
