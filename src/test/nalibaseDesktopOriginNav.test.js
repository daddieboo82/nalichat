// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase desktop mall origin navigation',()=>{
 it('keeps the originating mall active while inside shared storefronts',async()=>{ const s=await read('components/navigation/DesktopNav.jsx'); expect(s).toContain('resolveWorldForLocation(location.pathname, location.state?.fromWorld)'); expect(s).toContain('activeWorld?.id === worldId'); });
});
