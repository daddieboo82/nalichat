// @vitest-environment node
import { describe,expect,it } from 'vitest'; import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase public product copy',()=>{
 it('positions Studio and collaboration landing pages inside NaliBase',async()=>{ const a=await read('pages/MusicStudioLanding.jsx'); const b=await read('pages/MusicCollaborationLanding.jsx'); expect(a).toContain('NaliBase · CREATE world'); expect(a).toContain('Music Studio for Creators | NaliBase'); expect(b).toContain('NaliBase for music creators'); expect(b).toContain('Music Collaboration & Creator Messaging | NaliBase'); });
 it('uses NaliBase for cross-world transfer and support copy',async()=>{ expect(await read('components/files/LargeFileTransfer.jsx')).toContain('No NaliBase file-size limit'); expect(await read('components/home/DonationButton.jsx')).toContain('Support NaliBase'); });
});
