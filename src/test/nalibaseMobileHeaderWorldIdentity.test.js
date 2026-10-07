import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase mobile header simple identity',()=>{
 it('uses direct page titles without world prefix',async()=>{ const s=await read('components/navigation/MobileHeader.jsx'); expect(s).toContain('TITLES'); expect(s).toContain('baseTitle'); });
 it('shows clear page names in the header',async()=>{ const s=await read('components/navigation/MobileHeader.jsx'); expect(s).toContain('"/": "NaliBase"'); expect(s).toContain('"/messages": "Messages"'); expect(s).toContain('"/studio": "Studio"'); });
});