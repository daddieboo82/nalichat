import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase logout world isolation',()=>{
 it('provides a narrow active-world cleanup without deleting account visit history',async()=>{ const s=await read('lib/nalibaseWorldContext.js'); const fn=s.slice(s.indexOf('export function clearActiveWorldContext'),s.indexOf('export function getRememberedWorldForPath')); expect(fn).toContain('removeItem(WORLD_SESSION_KEY)'); expect(fn).not.toContain('WORLD_VISIT_KEY'); });
 it('clears active mall continuity during logout',async()=>{ const s=await read('lib/AuthContext.jsx'); expect(s).toContain("import { clearActiveWorldContext } from '@/lib/nalibaseWorldContext';"); expect(s).toContain('clearActiveWorldContext();'); });
});
