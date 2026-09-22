// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase shared file branding',()=>{
 it('brands public SHARE-world downloads as NaliBase',async()=>{ const s=await read('pages/SharedFileDownload.jsx'); expect(s).toContain('Securely shared through NaliBase.'); expect(s).toContain('NaliBase-file'); expect(s).not.toContain('Securely shared through NaliChat.'); });
});
