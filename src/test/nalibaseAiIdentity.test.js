// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
describe('Nali AI umbrella identity',()=>{
 for (const file of ['base44/agents/studio_ai.jsonc','base44/agents/studio_ai_plus.jsonc']) it(`${file} identifies Nali as embedded in NaliBase`,async()=>{ const s=await read(file); expect(s).toContain('embedded in NaliBase'); expect(s).toContain('authorized NaliBase context'); expect(s).not.toContain('embedded in NaliChat'); });
});
