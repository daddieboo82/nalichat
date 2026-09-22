// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase global logo identity',()=>{
 it('defaults the shared global mark to NaliBase while allowing contextual labels',async()=>{ const s=await read('components/branding/Logo.jsx'); expect(s).toContain('label = "NaliBase logo"'); expect(s).toContain('aria-label={label}'); expect(s).not.toContain('aria-label="NaliChat logo"'); });
});
