import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase desktop simple navigation registry',()=>{
 it('builds desktop nav from the canonical navigation config',async()=>{ const s=await read('components/navigation/DesktopNav.jsx'); expect(s).toContain('DESKTOP_MAIN_LINKS'); expect(s).toContain('DESKTOP_MORE_LINKS'); expect(s).toContain('navigationConfig'); });
 it('keeps a More dropdown for secondary features',async()=>{ const s=await read('components/navigation/DesktopNav.jsx'); expect(s).toContain('MoreHorizontal'); expect(s).toContain('DropdownMenuContent'); });
});