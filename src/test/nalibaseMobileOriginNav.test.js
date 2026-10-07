import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase mobile simple tab navigation',()=>{
 it('uses direct path matching for active tab detection',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('getActiveTab'); expect(s).toContain('pathname.startsWith'); });
 it('keeps five simple feature tabs from the canonical config',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('PRIMARY_TABS'); expect(s).toContain('SECONDARY_PATHS'); expect(s).toContain('__more__'); });
});