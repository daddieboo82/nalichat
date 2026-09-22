// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase mobile mall origin navigation',()=>{
 it('uses originating mall state for active tab and stack ownership',async()=>{ const s=await read('components/navigation/MobileNav.jsx'); expect(s).toContain('resolveWorldForLocation(path, location.state?.fromWorld)'); expect(s).toContain('getTabForPath(path, location.state?.fromWorld)'); expect(s).toContain('if (preferredWorld) return `/world/${preferredWorld}`'); });
});
