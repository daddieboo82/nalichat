// @vitest-environment node
import {describe,expect,it} from 'vitest'; import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
describe('remaining NaliBase umbrella identity',()=>{it('uses NaliBase for generic project member fallback',async()=>{const s=await read('src/components/studio/ProjectSettingsDialog.jsx');expect(s).toContain('NaliBase member');expect(s).not.toContain('NaliChat member');}); it('keeps CONNECT explicitly named NaliChat World',async()=>{const [world,ctx]=await Promise.all([read('src/pages/WorldHub.jsx'),read('src/lib/nalibaseWorldContext.js')]);expect(world).toContain('eyebrow: canonicalWorld.name');expect(ctx).toContain("name: 'NaliChat World'");});});
