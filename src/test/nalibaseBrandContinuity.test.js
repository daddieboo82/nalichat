// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase brand continuity',()=>{
 it('names the mobile root as the NaliBase Plaza',async()=>expect(await read('components/navigation/MobileHeader.jsx')).toContain('"/": "NaliBase Plaza"'));
 it('uses NaliBase account language in global mobile navigation',async()=>expect(await read('components/navigation/MobileHeader.jsx')).toContain('Create your NaliBase account'));
 it('does not retain the obsolete quick-access dashboard import',async()=>expect(await read('pages/Home.jsx')).not.toContain('import QuickAccessGrid'));
});
