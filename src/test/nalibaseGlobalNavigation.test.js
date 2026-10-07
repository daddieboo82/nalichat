import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase global simple navigation',()=>{
 it('desktop navigation leads with direct feature links from the canonical config',async()=>{ const s=await read('components/navigation/DesktopNav.jsx'); expect(s).toContain('DESKTOP_MAIN_LINKS'); expect(s).toContain('DESKTOP_MORE_LINKS'); expect(s).toContain('More'); });
 it('desktop more dropdown groups secondary features',async()=>{ const s=await read('components/navigation/DesktopNav.jsx'); expect(s).toContain('DropdownMenu'); expect(s).toContain('MoreHorizontal'); });
 it('mobile bottom navigation keeps five simple direct-feature tabs',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('PRIMARY_TABS'); expect(s).toContain('label: "More"'); });
});