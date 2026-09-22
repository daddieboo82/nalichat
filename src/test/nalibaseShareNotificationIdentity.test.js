// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
describe('NaliBase SHARE notification identity',()=>{
 it('uses NaliBase when a file-upload actor has no display name',async()=>{ const s=await read('base44/functions/notifyOnFileUpload/entry.ts'); expect(s).toContain("notification.actor_name || 'NaliBase'"); expect(s).not.toContain("notification.actor_name || 'NaliChat'"); });
});
