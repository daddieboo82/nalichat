import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase mobile menu feature registry',()=>{
 it('builds the drawer feature list from the canonical navigation config',async()=>{ const s=await read('components/navigation/MobileHeader.jsx'); expect(s).toContain('NAV_GROUPS'); expect(s).toContain('navigationConfig'); });
 it('opens the menu when the More tab dispatches the event',async()=>{ const s=await read('components/navigation/MobileHeader.jsx'); expect(s).toContain('open-mobile-menu'); });
 it('keeps each feature equipped with a description',async()=>{ const s=await read('lib/navigationConfig.js'); for (const label of ['Create','Connect','Discover','Compete']) expect(s).toContain(`label: "${label}"`); expect(s).toContain('desc:'); });
});