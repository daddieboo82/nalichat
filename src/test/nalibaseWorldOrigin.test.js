// @vitest-environment node
import { describe,expect,it } from 'vitest';
import { getWorldForPath } from '../lib/nalibaseWorldContext';
import { readFile } from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
describe('NaliBase storefront origin continuity',()=>{
 it('preserves an explicit mall for shared storefront routes',()=>{ expect(getWorldForPath('/studio','visualize')?.id).toBe('visualize'); expect(getWorldForPath('/messages','share')?.id).toBe('share'); expect(getWorldForPath('/cover-art','create')?.id).toBe('create'); expect(getWorldForPath('/explore','connect')?.id).toBe('connect'); });
 it('keeps canonical deep-link behavior without origin state',()=>{ expect(getWorldForPath('/studio')?.id).toBe('create'); expect(getWorldForPath('/explore')?.id).toBe('discover'); });
 it('passes mall origin through storefront links and shell consumers',async()=>{ expect(await read('pages/WorldHub.jsx')).toContain('state={{fromWorld:worldId}}'); for(const f of ['components/layout/WorldContinuityBar.jsx','components/layout/WorldAtmosphere.jsx','components/layout/StorefrontEntryTransition.jsx']) expect(await read(f)).toContain('location.state?.fromWorld'); });
});
