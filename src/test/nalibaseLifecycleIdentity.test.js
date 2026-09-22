// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
describe('NaliBase lifecycle identity',()=>{
 it('uses NaliBase for umbrella onboarding re-engagement',async()=>{ const s=await read('base44/functions/reengageStalledUsers/entry.ts'); expect(s).toContain('Finish setting up your NaliBase profile'); expect(s).toContain('The NaliBase Team'); });
 it('uses NaliBase for owner health reporting',async()=>{ const s=await read('base44/functions/naliHealthCheck/entry.ts'); expect(s).toContain('AI assistant for NaliBase'); expect(s).toContain('NaliBase Weekly Health Check'); });
});
