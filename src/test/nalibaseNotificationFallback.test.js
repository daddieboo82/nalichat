// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
describe('NaliBase global notification fallback',()=>{
 it('uses the umbrella brand only when a notification has no contextual title',async()=>{ const sw=await read('public/sw.js'); const push=await read('base44/shared/webPush.ts'); expect(sw).toContain("data.title || 'NaliBase'"); expect(push).toContain("payload.title || 'NaliBase'"); });
});
