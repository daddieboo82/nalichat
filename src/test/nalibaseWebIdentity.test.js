// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const root=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
describe('NaliBase web identity',()=>{
 it('brands browser metadata as NaliBase',async()=>{ const s=await root('index.html'); expect(s).toContain('<title>NaliChat by NaliBase | Music Studio, Messaging & Creator Community</title>'); expect(s).toContain('"name":"NaliChat by NaliBase"'); expect(s).toContain('MultimediaApplication'); });
 it('installs the web experience as NaliBase',async()=>{ const s=await root('public/manifest.json'); expect(s).toContain('"name": "NaliBase"'); expect(s).toContain('"short_name": "NaliBase"'); });
});