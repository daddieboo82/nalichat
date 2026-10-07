import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase desktop simple navigation',()=>{
 it('uses direct path matching for active link detection',async()=>{ const s=await read('components/navigation/DesktopNav.jsx'); expect(s).toContain('isActive'); expect(s).toContain('pathname.startsWith'); });
 it('keeps a More dropdown for secondary features',async()=>{ const s=await read('components/navigation/DesktopNav.jsx'); expect(s).toContain('DESKTOP_MORE_LINKS'); expect(s).toContain('MoreHorizontal'); });
});