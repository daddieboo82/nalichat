// @vitest-environment node
import {describe,expect,it} from 'vitest'; import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
describe('NaliBase app tester architecture',()=>{it('tests Plaza, six malls, storefront continuity and flagship Messages',async()=>{const s=await read('base44/agents/app_tester.jsonc'); for(const x of ['Central Plaza','CONNECT','CREATE','DISCOVER','SHARE','VISUALIZE','COMPETE','storefront','Messages as a non-admin user','NaliChat is the CONNECT world']) expect(s).toContain(x); expect(s).not.toContain('NaliChat music production platform');});});
