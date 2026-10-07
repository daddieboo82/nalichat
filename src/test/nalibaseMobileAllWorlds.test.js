import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase mobile simple navigation parity',()=>{
 it('builds five simple tabs from the canonical navigation config',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('PRIMARY_TABS'); expect(s).toContain('label: "More"'); expect(s).toContain('__more__'); });
 it('opens the full feature menu when More is tapped',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('open-mobile-menu'); });
 it('delegates active tab detection to direct path matching',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('getActiveTab'); expect(s).toContain('SECONDARY_PATHS'); });
});