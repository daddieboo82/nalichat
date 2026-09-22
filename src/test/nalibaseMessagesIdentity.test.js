// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
describe('Messages NaliBase identity',()=>{
 const files=['src/components/messages/InviteTab.jsx','src/components/messages/ExternalMessageDialog.jsx','src/components/messages/VoiceCardDialog.jsx','src/components/messages/ViralMomentDialog.jsx','src/components/messages/LockedChatAccessDialog.jsx'];
 for(const file of files) it(`${file} uses NaliBase`,async()=>{ const s=await read(file); expect(s).not.toContain('NaliChat'); expect(s).toContain('NaliBase'); });
 it('uses NaliBase for message notification privacy and fallback titles',async()=>{ const s=await read('base44/functions/notifyOnMessage/entry.ts'); expect(s).toContain("isLockedChat ? 'NaliBase'"); expect(s).toContain("notification.actor_name || 'NaliBase'"); });
});
