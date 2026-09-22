// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
describe('NaliBase CREATE notification identity',()=>{
 it('uses NaliBase when a track-version actor has no display name',async()=>{ const s=await read('base44/functions/notifyOnTrackVersion/entry.ts'); expect(s).toContain("notification.actor_name || 'NaliBase'"); expect(s).not.toContain("notification.actor_name || 'NaliChat'"); });
 it('preserves NaliChat privacy branding for locked CONNECT messages',async()=>{ const s=await read('base44/functions/notifyOnMessage/entry.ts'); expect(s).toContain("isLockedChat ? 'NaliChat'"); });
});
