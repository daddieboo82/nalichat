// @vitest-environment node
import {describe,expect,it} from 'vitest'; import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
describe('NaliBase/NaliChat brand boundary',()=>{
 it('keeps NaliChat scoped to CONNECT',async()=>{const [home,world,ctx]=await Promise.all([read('src/pages/Home.jsx'),read('src/pages/WorldHub.jsx'),read('src/lib/nalibaseWorldContext.js')]);expect(home).toContain('subtitle: "NaliChat"');expect(world).toContain('eyebrow: canonicalWorld.name');expect(ctx).toContain("name: 'NaliChat World'");});
 it('keeps released mobile/download identity stable',async()=>{const d=await read('src/pages/Download.jsx');expect(d).toContain('Download NaliChat');expect(d).toContain('com.nalichat');});
 it('keeps existing PayPal catalog identity stable until a dedicated billing migration',async()=>{const p=await read('base44/functions/setupPayPalPlans/entry.ts');expect(p).toContain('NaliChat Premium Monthly');expect(p).toContain('NaliChat Membership');});
 it('uses NaliBase language for current transfer implementation comments',async()=>{for(const f of ['src/lib/resumableUpload.js','base44/functions/createResumableTransferUpload/entry.ts']){const s=await read(f);expect(s).not.toContain('NaliChat total-size');expect(s).toContain('NaliBase');}});
});
