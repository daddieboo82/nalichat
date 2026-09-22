import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase recent-world truthfulness',()=>{
 it('does not write recent-visit history while merely resolving a shared storefront',async()=>{ const s=await read('lib/nalibaseWorldContext.js'); const resolver=s.slice(s.indexOf('export function resolveWorldForLocation')); expect(resolver).not.toContain('rememberWorldContext(stateWorld)'); expect(resolver).toContain('sessionStorage.setItem(WORLD_SESSION_KEY, stateWorld)'); });
 it('documents that only WorldHub entry counts as a recent visit',async()=>{ const s=await read('lib/nalibaseWorldContext.js'); expect(s).toContain('only entering WorldHub'); });
});
